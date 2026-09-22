import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type TeacherApplicationAdminRow = {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  diploma_url: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export const Route = createFileRoute("/_authenticated/admin/teacher-applications")({
  head: () => ({ meta: [{ title: "Заявки преподавателей — ОРТ Академия" }] }),
  component: TeacherApplicationsPage,
});

function TeacherApplicationsPage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: applications } = useQuery({
    queryKey: ["teacher-applications"],
    enabled: roles.includes("admin"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_applications")
        .select("id, user_id, email, full_name, diploma_url, status, rejection_reason, created_at, reviewed_at, reviewed_by")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as TeacherApplicationAdminRow[];
    },
  });

  const applicationsRows = (applications ?? []) as TeacherApplicationAdminRow[];

  const approveApplication = async (applicationId: string) => {
    if (!user) return;
    const { error } = await supabase.from("teacher_applications").update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    }).eq("id", applicationId);

    if (error) return toast.error(error.message);

    const application = applicationsRows.find((item) => item.id === applicationId);
    if (application?.user_id) {
      const { error: roleError } = await supabase.from("user_roles").upsert({
        user_id: application.user_id,
        role: "teacher",
      });
      if (roleError) return toast.error(roleError.message);
    }

    toast.success("Заявка одобрена");
    qc.invalidateQueries({ queryKey: ["teacher-applications"] });
    qc.invalidateQueries({ queryKey: ["teacher-application", application?.user_id] });
  };

  const rejectApplication = async () => {
    if (!selectedApplicationId || !user) return;
    const { error } = await supabase.from("teacher_applications").update({
      status: "rejected",
      rejection_reason: rejectionReason || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    }).eq("id", selectedApplicationId);

    if (error) return toast.error(error.message);

    toast.success("Заявка отклонена");
    setSelectedApplicationId(null);
    setRejectionReason("");
    qc.invalidateQueries({ queryKey: ["teacher-applications"] });
  };

  if (!roles.includes("admin")) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Доступ только для администраторов.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Заявки преподавателей</h1>
        <p className="text-muted-foreground">Проверяйте документы преподавателей и принимайте решения.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Список заявок</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-3 pr-3">ФИО</th>
                  <th className="py-3 pr-3">Email</th>
                  <th className="py-3 pr-3">Дата регистрации</th>
                  <th className="py-3 pr-3">Статус</th>
                  <th className="py-3 pr-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {applicationsRows.length === 0 && (
                  <tr>
                    <td className="py-8 text-center text-muted-foreground" colSpan={5}>
                      Заявок пока нет.
                    </td>
                  </tr>
                )}
                {applicationsRows.map((application) => (
                  <tr key={application.id} className="border-b">
                    <td className="py-3 pr-3">{application.full_name ?? "—"}</td>
                    <td className="py-3 pr-3">{application.email ?? "—"}</td>
                    <td className="py-3 pr-3">{new Date(application.created_at).toLocaleDateString("ru-RU")}</td>
                    <td className="py-3 pr-3">
                      {application.status === "approved" ? (
                        <Badge variant="secondary">🟢 Подтвержден</Badge>
                      ) : application.status === "rejected" ? (
                        <Badge variant="destructive">🔴 Отклонен</Badge>
                      ) : (
                        <Badge variant="outline">🟡 Ожидает проверки</Badge>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-2">
                        {application.diploma_url && (
                          <Button size="sm" variant="outline" onClick={() => window.open(application.diploma_url!, "_blank", "noopener,noreferrer")}>Просмотреть диплом</Button>
                        )}
                        <Button size="sm" onClick={() => approveApplication(application.id)}>Одобрить</Button>
                        <Button size="sm" variant="destructive" onClick={() => setSelectedApplicationId(application.id)}>Отклонить</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedApplicationId)} onOpenChange={(open) => !open && setSelectedApplicationId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Отклонить заявку</DialogTitle></DialogHeader>
          <Textarea
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Причина отказа"
            rows={5}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedApplicationId(null)}>Отмена</Button>
            <Button variant="destructive" onClick={rejectApplication}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
