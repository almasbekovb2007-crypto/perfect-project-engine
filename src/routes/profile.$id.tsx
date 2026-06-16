import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Lock, Trophy } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/profile/$id")({
  head: () => ({ meta: [{ title: "Профиль — ОРТ Академия" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { id } = useParams({ from: "/profile/$id" });
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      const [profile, attempts, lessons] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("test_attempts").select("score,total,completed_at").eq("user_id", id),
        supabase.from("lesson_progress").select("id").eq("user_id", id),
      ]);
      return { profile: profile.data, attempts: attempts.data ?? [], lessons: lessons.data?.length ?? 0 };
    },
  });

  return (
    <div className="min-h-screen bg-background">
      {user ? <AppNav /> : null}
      <div className="container mx-auto max-w-3xl px-4 py-10">
        {!data?.profile ? (
          <Card><CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Lock className="h-10 w-10 text-muted-foreground" />
            <div className="text-lg font-medium">Профиль скрыт или не найден</div>
            <p className="text-sm text-muted-foreground">Пользователь закрыл свой профиль в настройках приватности.</p>
          </CardContent></Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <div className="gradient-hero p-8 text-primary-foreground">
                <Avatar className="h-20 w-20 border-4 border-white/30">
                  <AvatarFallback className="bg-white/15 text-2xl text-white">{(data.profile.full_name ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <h1 className="mt-4 text-3xl font-bold">{data.profile.full_name ?? "Без имени"}</h1>
                {data.profile.bio && <p className="mt-2 text-primary-foreground/85">{data.profile.bio}</p>}
              </div>
            </Card>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <StatBox label="Попыток тестов" value={String(data.attempts.length)} />
              <StatBox label="Уроков изучено" value={String(data.lessons)} />
              <StatBox label="Баллов всего" value={String(data.attempts.reduce((a, b) => a + (b.score ?? 0), 0))} />
            </div>
            <Card className="mt-6">
              <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Последние попытки</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.attempts.length === 0 && <p className="text-sm text-muted-foreground">Пока нет результатов.</p>}
                {data.attempts.slice(-10).reverse().map((a, i) => (
                  <div key={i} className="flex justify-between rounded-lg border border-border p-3 text-sm">
                    <span className="text-muted-foreground">{new Date(a.completed_at).toLocaleDateString("ru-RU")}</span>
                    <span className="font-semibold">{a.score}/{a.total}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="pt-6">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    </CardContent></Card>
  );
}
