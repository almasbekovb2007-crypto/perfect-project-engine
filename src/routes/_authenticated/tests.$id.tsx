import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Check, X, Trophy, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Question {
  id: string;
  text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
}

export const Route = createFileRoute("/_authenticated/tests/$id")({
  head: () => ({ meta: [{ title: "Тест — ОРТ Академия" }] }),
  component: TestPage,
});

function TestPage() {
  const { id } = useParams({ from: "/_authenticated/tests/$id" });
  const { user, roles } = useAuth();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; details: { q: Question; selected?: number }[] } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["test", id],
    queryFn: async () => {
      const [test, qs] = await Promise.all([
        supabase.from("tests").select("*").eq("id", id).maybeSingle(),
        supabase.from("questions").select("*").eq("test_id", id).order("order_index"),
      ]);
      const questions = ((qs.data ?? []) as { options: unknown }[]).map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? q.options : (typeof q.options === "string" ? JSON.parse(q.options) : []),
      })) as unknown as Question[];
      return { test: test.data, questions };
    },
  });

  if (isLoading) return <div className="py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!data?.test) return <div className="py-12 text-center text-muted-foreground">Тест не найден.</div>;
  if (data.questions.length === 0) return <div className="py-12 text-center text-muted-foreground">К тесту пока не добавлены вопросы.</div>;

  const total = data.questions.length;

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      let score = 0;
      const details = data.questions.map((q) => {
        const selected = answers[q.id];
        const correct = selected === q.correct_index;
        if (correct) score++;
        return { q, selected };
      });

      const { data: attempt, error: aErr } = await supabase
        .from("test_attempts")
        .insert({ user_id: user.id, test_id: id, score, total })
        .select("id")
        .single();
      if (aErr) throw aErr;

      const ansRows = details.map((d) => ({
        attempt_id: attempt.id,
        question_id: d.q.id,
        selected_index: d.selected ?? null,
        is_correct: d.selected === d.q.correct_index,
      }));
      await supabase.from("attempt_answers").insert(ansRows);

      const mistakeRows = details
        .filter((d) => d.selected !== d.q.correct_index)
        .map((d) => ({ user_id: user.id, question_id: d.q.id, resolved: false }));
      if (mistakeRows.length > 0) {
        await supabase.from("mistakes").upsert(mistakeRows, { onConflict: "user_id,question_id", ignoreDuplicates: false });
      }
      const correctIds = details.filter((d) => d.selected === d.q.correct_index).map((d) => d.q.id);
      if (correctIds.length) {
        await supabase.from("mistakes").update({ resolved: true }).eq("user_id", user.id).in("question_id", correctIds);
      }

      setResult({ score, total, details });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const pct = Math.round((100 * result.score) / result.total);
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="overflow-hidden">
          <div className="gradient-hero p-8 text-primary-foreground">
            <Trophy className="h-10 w-10" />
            <h2 className="mt-3 text-3xl font-bold">Результат: {result.score}/{result.total}</h2>
            <p className="text-primary-foreground/85">Точность {pct}%</p>
          </div>
        </Card>
        <div className="space-y-4">
          {result.details.map((d, i) => {
            const correct = d.selected === d.q.correct_index;
            return (
              <Card key={d.q.id} className={correct ? "border-success/50" : "border-destructive/50"}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${correct ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}>
                      {correct ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-muted-foreground">Вопрос {i + 1}</div>
                      <div className="mt-1 font-medium">{d.q.text}</div>
                      <div className="mt-3 space-y-1 text-sm">
                        {d.q.options.map((o, idx) => (
                          <div
                            key={idx}
                            className={`rounded-lg px-3 py-2 ${
                              idx === d.q.correct_index
                                ? "bg-success/15 text-foreground"
                                : idx === d.selected
                                ? "bg-destructive/15 text-foreground"
                                : "bg-secondary/50"
                            }`}
                          >
                            {o}
                          </div>
                        ))}
                      </div>
                      {d.q.explanation && (
                        <div className="mt-3 rounded-lg bg-secondary p-3 text-sm">
                          <span className="font-semibold">Объяснение: </span>{d.q.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="flex justify-between gap-2">
          <Link to="/mistakes"><Button variant="outline">К моим ошибкам</Button></Link>
          <Link to="/dashboard"><Button>На дашборд</Button></Link>
        </div>
      </div>
    );
  }

  const q = data.questions[step];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{data.test.title}</h1>
        <div className="mt-3">
          <Progress value={((step + 1) / total) * 100} />
          <div className="mt-1 text-xs text-muted-foreground">Вопрос {step + 1} из {total}</div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg leading-snug">{q.text}</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={answers[q.id]?.toString() ?? ""}
            onValueChange={(v) => setAnswers({ ...answers, [q.id]: parseInt(v) })}
          >
            {q.options.map((o, idx) => (
              <Label
                key={idx}
                htmlFor={`${q.id}-${idx}`}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-secondary [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"
              >
                <RadioGroupItem id={`${q.id}-${idx}`} value={idx.toString()} />
                <span className="text-sm">{o}</span>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
          Назад
        </Button>
        {step < total - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={answers[q.id] === undefined}>
            Далее
          </Button>
        ) : (
          <Button onClick={submit} disabled={submitting || Object.keys(answers).length !== total}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Завершить тест
          </Button>
        )}
      </div>
    </div>
  );
}
