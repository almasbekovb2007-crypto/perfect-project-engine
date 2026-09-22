import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, FileText, ListChecks } from "lucide-react";

export const Route = createFileRoute("/_authenticated/courses/$id")({
  head: () => ({ meta: [{ title: "Курс — ОРТ Академия" }] }),
  component: CourseDetail,
});

function CourseDetail() {
  const { id } = useParams({ from: "/_authenticated/courses/$id" });
  const navigate = useNavigate();
  const { user, roles } = useAuth();

  const { data, error } = useQuery({
    queryKey: ["course", id],
    queryFn: async () => {
      const [course, lessons, tests] = await Promise.all([
        supabase.from("courses").select("*, subjects(name, icon)").eq("id", id).maybeSingle(),
        supabase.from("lessons").select("id, title, order_index").eq("course_id", id).order("order_index"),
        supabase.from("tests").select("id, title, description").eq("course_id", id),
      ]);
      if (course.error) throw course.error;
      if (lessons.error) throw lessons.error;
      if (tests.error) throw tests.error;
      return {
        course: course.data,
        lessons: lessons.data ?? [],
        tests: tests.data ?? [],
      };
    },
  });

  if (error) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>Ошибка загрузки курса: {error.message}</p>
      </div>
    );
  }

  if (!data?.course) return <div className="py-12 text-center text-muted-foreground">Курс не найден.</div>;

  const subj = data.course.subjects as { name?: string; icon?: string } | null;

  return (
    <div className="space-y-8">
      <div className="rounded-3xl gradient-card border border-border p-8">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{subj?.icon ?? "📘"}</span>
          <Badge variant="secondary">{subj?.name ?? "Курс"}</Badge>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{data.course.title}</h1>
        {data.course.description && <p className="mt-2 max-w-2xl text-muted-foreground">{data.course.description}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Уроки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.lessons.length === 0 && <p className="text-sm text-muted-foreground">Уроки появятся скоро.</p>}
            {data.lessons.map((l, i) => (
              <button
                key={l.id}
                type="button"
                className="w-full text-left"
                onClick={() => navigate({ to: "/lessons/$id", params: { id: l.id } })}
              >
                <div className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-sm font-semibold text-primary">{i + 1}</div>
                    <div className="font-medium">{l.title}</div>
                  </div>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5" /> Тесты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.tests.length === 0 && <p className="text-sm text-muted-foreground">Тестов пока нет.</p>}
            {data.tests.map((t) => (
              <button
                key={t.id}
                type="button"
                className="w-full text-left"
                onClick={() => navigate({ to: "/tests/$id", params: { id: t.id } })}
              >
                <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary">
                  <div className="font-medium">{t.title}</div>
                  {t.description && <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</div>}
                  <Button variant="link" className="mt-2 h-auto p-0 text-primary">Пройти тест →</Button>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
