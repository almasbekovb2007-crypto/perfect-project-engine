import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teacher")({
  head: () => ({ meta: [{ title: "Кабинет преподавателя — ОРТ Академия" }] }),
  component: TeacherPage,
});

function TeacherPage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("subjects").select("*").order("name")).data ?? [],
  });

  const { data: courses } = useQuery({
    queryKey: ["my-courses", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("courses").select("*, subjects(name)").eq("teacher_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [open, setOpen] = useState(false);

  const createCourse = async () => {
    if (!user || !title) return;
    const { error } = await supabase.from("courses").insert({
      title, description: desc || null, subject_id: subjectId || null, teacher_id: user.id, is_published: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Курс создан");
    setOpen(false); setTitle(""); setDesc(""); setSubjectId("");
    qc.invalidateQueries({ queryKey: ["my-courses"] });
  };

  if (!roles.includes("teacher") && !roles.includes("admin")) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        Доступ только для преподавателей. Обратитесь к администратору.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Кабинет преподавателя</h1>
          <p className="text-muted-foreground">Создавайте и управляйте своими курсами.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Новый курс</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Новый курс</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Название</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="space-y-2"><Label>Описание</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
              <div className="space-y-2"><Label>Предмет</Label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>
                    {(subjects ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={createCourse}>Создать</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Мои курсы</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(courses ?? []).length === 0 && <p className="text-sm text-muted-foreground">Курсов пока нет.</p>}
          {(courses ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <div className="font-medium">{c.title}</div>
                <div className="text-xs text-muted-foreground">{(c.subjects as { name?: string } | null)?.name}</div>
              </div>
              <div className="flex gap-2">
                <a href={`/courses/${c.id}`}><Button variant="outline" size="sm">Открыть</Button></a>
                <Button variant="ghost" size="sm" onClick={async () => {
                  if (!confirm("Удалить курс?")) return;
                  await supabase.from("courses").delete().eq("id", c.id);
                  qc.invalidateQueries({ queryKey: ["my-courses"] });
                }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Подсказка</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Для добавления уроков и тестов к курсу — откройте курс и используйте кнопки управления в его карточке (расширенный редактор).
          Базовые операции доступны через панель базы данных в кабинете преподавателя.
        </CardContent>
      </Card>
    </div>
  );
}
