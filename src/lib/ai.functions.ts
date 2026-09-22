import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  chat_id: z.string().uuid(),
  message: z.string().min(1).max(4000),
});

const SYSTEM_PROMPT = `Ты — ИИ-помощник платформы «ОРТ Академия» для подготовки абитуриентов к Общереспубликанскому тестированию (ОРТ) в Кыргызстане.
Твои задачи:
- объяснять решения задач по математике, русскому языку, истории и логике;
- определять слабые места в знаниях;
- рекомендовать темы и составлять план подготовки;
- отвечать кратко, дружелюбно и по-русски.
Если вопрос вне образовательного контекста — вежливо перенаправь к подготовке к ОРТ.`;

export const sendAssistantMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify chat ownership
    const { data: chat, error: cErr } = await supabase
      .from("ai_chats")
      .select("id, user_id")
      .eq("id", data.chat_id)
      .maybeSingle();
    if (cErr || !chat || chat.user_id !== userId) {
      throw new Error("Чат не найден");
    }

    // Save user message
    await supabase.from("ai_messages").insert({
      chat_id: data.chat_id,
      role: "user",
      content: data.message,
    });

    // Load history
    const { data: history } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("chat_id", data.chat_id)
      .order("created_at", { ascending: true })
      .limit(40);

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...((history ?? []) as { role: string; content: string }[]),
    ];

    // ===== AI provider call =====
    // The user will provide the AI API key via environment variable AI_API_KEY.
    // Supported by default: any OpenAI-compatible endpoint (set AI_BASE_URL and AI_MODEL).
    // Defaults below are placeholders — replace via env vars.
    const apiKey = process.env.AI_API_KEY;
    const baseUrl = process.env.AI_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.AI_MODEL || "gpt-4o-mini";
    const isGemini = baseUrl.includes("generativelanguage.googleapis.com");

    let assistantReply: string;

    if (!apiKey) {
      assistantReply =
        "⚠️ ИИ-помощник пока не настроен.\n\nДобавьте переменную окружения `AI_API_KEY` (и при необходимости `AI_BASE_URL`, `AI_MODEL`) в настройках бэкенда, чтобы активировать ответы.";
    } else {
      try {
        const endpoint = isGemini
          ? `${baseUrl}/models/${model}:generateContent?key=${apiKey}`
          : `${baseUrl}/chat/completions`;

        const payload = isGemini
          ? {
              contents: [{ role: "user", parts: [{ text: messages.map((m) => `${m.role}: ${m.content}`).join("\n\n") }] }],
            }
          : {
              model,
              messages,
              temperature: 0.4,
            };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: isGemini
            ? { "Content-Type": "application/json" }
            : {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`AI ${res.status}: ${text.slice(0, 200)}`);
        }
        const json = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        assistantReply = isGemini
          ? json.candidates?.[0]?.content?.parts?.map((p) => p.text).join("")?.trim() || "Извините, не удалось получить ответ."
          : json.choices?.[0]?.message?.content?.trim() || "Извините, не удалось получить ответ.";
      } catch (e) {
        assistantReply = `Ошибка ИИ-сервиса: ${e instanceof Error ? e.message : "unknown"}`;
      }
    }

    await supabase.from("ai_messages").insert({
      chat_id: data.chat_id,
      role: "assistant",
      content: assistantReply,
    });

    return { reply: assistantReply };
  });
