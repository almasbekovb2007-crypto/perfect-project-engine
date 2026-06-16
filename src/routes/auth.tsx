import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Loader2 } from "lucide-react";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional().default("login"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Вход — ОРТ Академия" },
      { name: "description", content: "Войдите или создайте аккаунт для доступа к курсам и тестам подготовки к ОРТ." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName || email.split("@")[0] },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        toast.success("Аккаунт создан! Добро пожаловать.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("С возвращением!");
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Не удалось выполнить вход";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden gradient-hero p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <GraduationCap className="h-5 w-5" />
          </span>
          ОРТ Академия
        </Link>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Готовься к ОРТ умнее, а не дольше.
          </h1>
          <p className="mt-4 max-w-md text-primary-foreground/85">
            Персональные тесты, аналитика прогресса и ИИ-помощник, который объясняет каждый шаг решения.
          </p>
        </div>
        <div className="text-sm text-primary-foreground/80">© {new Date().getFullYear()} ОРТ Академия</div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground lg:hidden">
            <GraduationCap className="h-4 w-4" /> ОРТ Академия
          </Link>
          <h2 className="text-2xl font-bold tracking-tight">
            {mode === "login" ? "Войти в аккаунт" : "Создать аккаунт"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Введите данные для входа в ОРТ Академию."
              : "Бесплатная регистрация. Доступ к курсам и ИИ-помощнику."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Имя</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Айдай Усенова" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" ? "Войти" : "Создать аккаунт"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>Нет аккаунта?{" "}
                <button className="font-medium text-primary hover:underline" onClick={() => setMode("signup")}>
                  Зарегистрироваться
                </button>
              </>
            ) : (
              <>Уже есть аккаунт?{" "}
                <button className="font-medium text-primary hover:underline" onClick={() => setMode("login")}>
                  Войти
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
