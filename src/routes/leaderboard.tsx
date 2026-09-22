import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { AppNav } from "@/components/AppNav";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({ meta: [{ title: "Рейтинг — ОРТ Академия" }, { name: "description", content: "Рейтинг абитуриентов, готовящихся к ОРТ." }] }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const { data: leaderboard } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => (await supabase.from("leaderboard").select("*").limit(200)).data ?? [],
  });

  const { data: userRoles } = useQuery({
    queryKey: ["user_roles"],
    queryFn: async () => (await supabase.from("user_roles").select("user_id, role")).data ?? [],
  });

  const teacherAndAdminIds = new Set(
    (userRoles ?? [])
      .filter((ur) => ur.role === "teacher" || ur.role === "admin")
      .map((ur) => ur.user_id)
  );

  const filtered = (leaderboard ?? [])
    .filter((r) => !teacherAndAdminIds.has(r.user_id as string))
    .filter((r) => !q || (r.full_name ?? "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-screen bg-background">
      {user ? <AppNav /> : null}
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3"><Trophy className="h-8 w-8 text-accent" /> Рейтинг</h1>
          <p className="text-muted-foreground">Открытые профили абитуриентов по сумме баллов.</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Поиск по имени..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
        </div>

        <Card>
          <CardHeader><CardTitle>Лидеры</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Рейтинг пока пуст.</p>}
            {filtered.map((r, i) => (
              <Link key={r.user_id} to="/profile/$id" params={{ id: r.user_id as string }}>
                <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold ${i < 3 ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"}`}>
                    {i + 1}
                  </div>
                  <Avatar><AvatarFallback className="bg-primary text-primary-foreground">{(r.full_name ?? "?").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                  <div className="flex-1">
                    <div className="font-semibold">{r.full_name ?? "Без имени"}</div>
                    <div className="text-xs text-muted-foreground">{r.attempts_count ?? 0} попыток · точность {r.accuracy ?? 0}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">{r.total_score ?? 0}</div>
                    <div className="text-xs text-muted-foreground">из {r.total_questions ?? 0}</div>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
