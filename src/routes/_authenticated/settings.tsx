import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Настройки — ОРТ Академия" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [full_name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [is_public, setPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setName(data.full_name ?? "");
        setBio(data.bio ?? "");
        setPublic(data.is_public ?? true);
      }
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name, bio, is_public, updated_at: new Date().toISOString() }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Настройки сохранены");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Настройки профиля</h1>
        <p className="text-muted-foreground">Управляйте именем, описанием и приватностью.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Профиль</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Имя</Label>
            <Input value={full_name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>О себе</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div>
              <div className="font-medium">Открытый профиль</div>
              <div className="text-sm text-muted-foreground">Другие абитуриенты смогут видеть ваш профиль и результаты в рейтинге.</div>
            </div>
            <Switch checked={is_public} onCheckedChange={setPublic} />
          </div>
          <Button onClick={save} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
