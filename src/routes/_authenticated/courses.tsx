import { createFileRoute, Link, useNavigate, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/courses")({
  head: () => ({
    meta: [
      { title: "Курсы — ОРТ Академия" },
      { name: "description", content: "Каталог курсов подготовки к ОРТ: математика, русский язык, история, аналогии." },
    ],
  }),
  component: CoursesPage,
});

function CoursesPage() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("subjects").select("*").order("name")).data ?? [],
  });

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () =>
      (await supabase
        .from("courses")
        .select("id, title, description, cover_url, subject_id, is_published, subjects(name, icon)")
        .order("created_at", { ascending: false })).data ?? [],
  });

  const filtered = (courses ?? []).filter((c) =>
    !q || c.title.toLowerCase().includes(q.toLowerCase()) || (c.description ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Курсы</h1>
        <p className="text-muted-foreground">Выберите предмет и приступайте к подготовке.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Поиск курса..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(subjects ?? []).map((s) => (
          <Card key={s.id} className="overflow-hidden">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="text-3xl">{s.icon ?? "📘"}</div>
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-muted-foreground">
                  {(courses ?? []).filter((c) => c.subject_id === s.id).length} курсов
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="py-12 text-center text-muted-foreground">
              Курсы скоро появятся. Преподаватели наполняют каталог.
            </CardContent>
          </Card>
        )}
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            className="w-full text-left"
            onClick={() => navigate({ to: "/courses/$id", params: { id: c.id } })}
          >
            <Card className="h-full transition-shadow hover:shadow-soft">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">
                    {(c.subjects as { name?: string } | null)?.name ?? "Курс"}
                  </Badge>
                </div>
                <CardTitle className="mt-2">{c.title}</CardTitle>
                <CardDescription className="line-clamp-3">{c.description}</CardDescription>
              </CardHeader>
            </Card>
          </button>
        ))}
      </section>

      <Outlet />
    </div>
  );
}
