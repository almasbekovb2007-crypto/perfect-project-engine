import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Админ — ОРТ Академия" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"student" | "teacher" | "admin">("teacher");

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: allRoles } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [],
  });

  if (!roles.includes("admin")) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Доступ только для администраторов.</CardContent></Card>;
  }

  if (location.pathname.startsWith("/admin/teacher-applications")) {
    return <Outlet />;
  }

  const assignRole = async (userId: string) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) toast.error(error.message);
    else { toast.success("Роль назначена"); qc.invalidateQueries({ queryKey: ["admin-roles"] }); }
  };

  const removeRole = async (id: string) => {
    await supabase.from("user_roles").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-roles"] });
  };

  const filtered = (users ?? []).filter((u) => !email || (u.full_name ?? "").toLowerCase().includes(email.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Администрирование</h1>
        <p className="text-muted-foreground">Управление ролями пользователей.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Назначение роли</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_200px]">
            <Input placeholder="Поиск по имени" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Select value={role} onValueChange={(v) => setRole(v as "student" | "teacher" | "admin")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Абитуриент</SelectItem>
                <SelectItem value="teacher">Преподаватель</SelectItem>
                <SelectItem value="admin">Администратор</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filtered.map((u) => {
              const userRoles = (allRoles ?? []).filter((r) => r.user_id === u.id);
              return (
                <div key={u.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <div className="font-medium">{u.full_name ?? "Без имени"}</div>
                    <div className="mt-1 flex gap-1">
                      {userRoles.map((r) => (
                        <button key={r.id} onClick={() => removeRole(r.id)} className="rounded-full bg-secondary px-2 py-0.5 text-xs hover:bg-destructive/15">
                          {r.role} ✕
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => assignRole(u.id)}>+ {role}</Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
