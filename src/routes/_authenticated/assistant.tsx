import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { sendAssistantMessage } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { BrainCircuit, Loader2, Plus, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [{ title: "ИИ-помощник — ОРТ Академия" }] }),
  component: AssistantPage,
});

function AssistantPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const send = useServerFn(sendAssistantMessage);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: chats } = useQuery({
    queryKey: ["chats", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("ai_chats").select("*").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });

  useEffect(() => {
    if (!activeChat && chats && chats.length > 0) setActiveChat(chats[0].id);
  }, [chats, activeChat]);

  const { data: messages } = useQuery({
    queryKey: ["chat-messages", activeChat],
    enabled: !!activeChat,
    queryFn: async () => (await supabase.from("ai_messages").select("*").eq("chat_id", activeChat!).order("created_at")).data ?? [],
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const newChat = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("ai_chats").insert({ user_id: user.id, title: "Новый чат" }).select().single();
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["chats"] });
    setActiveChat(data.id);
  };

  const submit = async () => {
    if (!input.trim()) return;
    let chatId = activeChat;
    if (!chatId && user) {
      const { data } = await supabase.from("ai_chats").insert({ user_id: user.id, title: input.slice(0, 40) }).select().single();
      chatId = data?.id ?? null;
      setActiveChat(chatId);
      qc.invalidateQueries({ queryKey: ["chats"] });
    }
    if (!chatId) return;
    const msg = input;
    setInput("");
    setSending(true);
    try {
      await send({ data: { chat_id: chatId, message: msg } });
      qc.invalidateQueries({ queryKey: ["chat-messages", chatId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid h-[calc(100vh-8rem)] gap-4 md:grid-cols-[260px_1fr]">
      <Card className="hidden flex-col p-3 md:flex">
        <Button onClick={newChat} className="mb-3"><Plus className="mr-2 h-4 w-4" /> Новый чат</Button>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {(chats ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveChat(c.id)}
              className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm ${activeChat === c.id ? "bg-secondary font-medium" : "hover:bg-secondary/50"}`}
            >
              {c.title}
            </button>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><BrainCircuit className="h-5 w-5" /></div>
          <div>
            <div className="font-semibold">ИИ-помощник</div>
            <div className="text-xs text-muted-foreground">Объяснит и составит план подготовки</div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {(messages ?? []).length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <BrainCircuit className="h-12 w-12 text-primary/40" />
              <p className="mt-3 max-w-sm">Спросите про любую тему ОРТ — помощник объяснит и порекомендует материалы.</p>
            </div>
          )}
          {(messages ?? []).map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.role === "user" ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-secondary"}`}>
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start"><div className="rounded-2xl bg-secondary px-4 py-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /></div></div>
          )}
        </div>

        <div className="border-t border-border p-3">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Спросите ИИ-помощника..."
              rows={2}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <Button onClick={submit} disabled={sending || !input.trim()} size="lg" className="h-auto">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
