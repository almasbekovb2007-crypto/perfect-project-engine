import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, BookOpenCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mistakes")({
  head: () => ({ meta: [{ title: "Мои ошибки — ОРТ Академия" }] }),
  component: MistakesPage,
});

interface MistakeRow {
  id: string;
  resolved: boolean;
  created_at: string;
  question_id: string;
  questions: {
    id: string;
    text: string;
    options: unknown;
    correct_index: number;
    explanation: string | null;
    topic: string | null;
    tests: { id: string; title: string } | null;
  } | null;
}

function MistakesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "open">("open");

  const { data } = useQuery({
    queryKey: ["mistakes", user?.id, filter],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("mistakes")
        .select("id, resolved, created_at, question_id, questions(id, text, options, correct_index, explanation, topic, tests(id, title))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (filter === "open") q = q.eq("resolved", false);
      return ((await q).data ?? []) as unknown as MistakeRow[];
    },
  });

  const markResolved = async (mid: string) => {
    await supabase.from("mistakes").update({ resolved: true }).eq("id", mid);
    toast.success("Отмечено как разобранное");
    qc.invalidateQueries({ queryKey: ["mistakes"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Мои ошибки</h1>
          <p className="text-muted-foreground">Повторите вопросы, в которых ошиблись.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={filter === "open" ? "default" : "outline"} onClick={() => setFilter("open")}>В работе</Button>
          <Button variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Все</Button>
        </div>
      </div>

      <div className="space-y-3">
        {(data ?? []).length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <BookOpenCheck className="h-10 w-10 text-success" />
              <div>Здесь будут вопросы, в которых вы ошиблись.</div>
            </CardContent>
          </Card>
        )}
        {(data ?? []).map((m) => {
          const q = m.questions;
          if (!q) return null;
          const options: string[] = Array.isArray(q.options) ? (q.options as string[]) : [];
          return (
            <Card key={m.id} className={m.resolved ? "border-success/30" : ""}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  {q.tests && <Badge variant="secondary" className="mb-2">{q.tests.title}</Badge>}
                  {q.topic && <Badge className="mb-2 ml-2 bg-accent text-accent-foreground">{q.topic}</Badge>}
                  <CardTitle className="text-base leading-snug">{q.text}</CardTitle>
                </div>
                {m.resolved ? (
                  <Badge className="bg-success text-success-foreground">Разобрано</Badge>
                ) : (
                  <Badge variant="destructive">В работе</Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {options.map((o, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                      idx === q.correct_index ? "bg-success/15" : "bg-secondary/50"
                    }`}
                  >
                    {idx === q.correct_index ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    {o}
                  </div>
                ))}
                {q.explanation && (
                  <div className="rounded-lg bg-secondary p-3 text-sm">
                    <span className="font-semibold">Объяснение: </span>{q.explanation}
                  </div>
                )}
                {!m.resolved && (
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => markResolved(m.id)}>
                      Отметить как разобранное
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
