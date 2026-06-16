import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lessons/$id")({
  head: () => ({ meta: [{ title: "Урок — ОРТ Академия" }] }),
  component: LessonPage,
});

function LessonPage() {
  const { id } = useParams({ from: "/_authenticated/lessons/$id" });
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["lesson", id, user?.id],
    queryFn: async () => {
      const [lesson, prog] = await Promise.all([
        supabase.from("lessons").select("*, courses(id, title)").eq("id", id).maybeSingle(),
        user
          ? supabase.from("lesson_progress").select("id").eq("user_id", user.id).eq("lesson_id", id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { lesson: lesson.data, done: !!prog.data };
    },
  });

  const markDone = async () => {
    if (!user) return;
    const { error } = await supabase.from("lesson_progress").insert({ user_id: user.id, lesson_id: id });
    if (error && !error.message.includes("duplicate")) {
      toast.error(error.message);
      return;
    }
    toast.success("Урок отмечен как изученный!");
    qc.invalidateQueries({ queryKey: ["lesson", id] });
  };

  if (!data?.lesson) return <div className="py-12 text-center text-muted-foreground">Урок не найден.</div>;

  const course = data.lesson.courses as { id: string; title: string } | null;

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      {course && (
        <Link to="/courses/$id" params={{ id: course.id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {course.title}
        </Link>
      )}
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{data.lesson.title}</h1>

      <Card>
        <CardContent className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-wrap pt-6 text-[15px] leading-relaxed">
          {data.lesson.content || "Содержимое урока скоро будет добавлено."}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={markDone} disabled={data.done} size="lg">
          <Check className="mr-2 h-4 w-4" />
          {data.done ? "Изучено" : "Отметить как изученный"}
        </Button>
      </div>
    </article>
  );
}
