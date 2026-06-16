import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, BrainCircuit, Flame, GraduationCap, Target, Trophy } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Дашборд — ОРТ Академия" },
      { name: "description", content: "Ваш прогресс подготовки к ОРТ, статистика и быстрый доступ к курсам и тестам." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const uid = user?.id;

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", uid],
    enabled: !!uid,
    queryFn: async () => {
      const [attempts, mistakes, progress] = await Promise.all([
        supabase.from("test_attempts").select("score,total,completed_at").eq("user_id", uid!).order("completed_at"),
        supabase.from("mistakes").select("id,resolved").eq("user_id", uid!),
        supabase.from("lesson_progress").select("id").eq("user_id", uid!),
      ]);
      return {
        attempts: attempts.data ?? [],
        mistakes: mistakes.data ?? [],
        lessonsDone: (progress.data ?? []).length,
      };
    },
  });

  const totalScore = stats?.attempts.reduce((a, b) => a + (b.score ?? 0), 0) ?? 0;
  const totalQ = stats?.attempts.reduce((a, b) => a + (b.total ?? 0), 0) ?? 0;
  const accuracy = totalQ ? Math.round((100 * totalScore) / totalQ) : 0;
  const unresolvedMistakes = stats?.mistakes.filter((m) => !m.resolved).length ?? 0;

  const chartData =
    stats?.attempts.map((a, i) => ({
      idx: i + 1,
      score: a.total ? Math.round((100 * (a.score ?? 0)) / a.total) : 0,
    })) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">С возвращением 👋</p>
          <h1 className="text-3xl font-bold tracking-tight">Готовимся к ОРТ</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/courses">
            <Button variant="outline"><BookOpen className="mr-2 h-4 w-4" /> К курсам</Button>
          </Link>
          <Link to="/assistant">
            <Button><BrainCircuit className="mr-2 h-4 w-4" /> ИИ-помощник</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={<Target />} label="Точность" value={`${accuracy}%`} hint={`${totalScore} из ${totalQ}`} />
        <StatCard icon={<Flame />} label="Попыток тестов" value={String(stats?.attempts.length ?? 0)} hint="всего" />
        <StatCard icon={<GraduationCap />} label="Уроки изучены" value={String(stats?.lessonsDone ?? 0)} hint="завершено" />
        <StatCard icon={<Trophy />} label="Не разобраны" value={String(unresolvedMistakes)} hint="ошибок в работе" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Динамика результатов</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {chartData.length === 0 ? (
              <Empty text="Пройдите первый тест, чтобы увидеть динамику" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="idx" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                    }}
                    formatter={(v: number) => `${v}%`}
                  />
                  <Line type="monotone" dataKey="score" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Общий прогресс</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <ProgressRow label="Точность ответов" value={accuracy} />
            <ProgressRow label="Покрытие уроков" value={Math.min(100, (stats?.lessonsDone ?? 0) * 5)} />
            <ProgressRow label="Закрытые ошибки" value={stats && stats.mistakes.length ? Math.round(100 * (stats.mistakes.length - unresolvedMistakes) / stats.mistakes.length) : 0} />
            <Link to="/mistakes" className="block">
              <Button variant="secondary" className="w-full">Работа над ошибками →</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-xs text-muted-foreground/70">{hint}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}%</span>
      </div>
      <Progress value={value} />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{text}</div>
  );
}
