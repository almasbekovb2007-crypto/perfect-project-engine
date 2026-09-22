import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

const STUDENT_NAV = [
  { to: "/dashboard", label: "Главная" },
  { to: "/courses", label: "Курсы" },
  { to: "/mistakes", label: "Мои ошибки" },
  { to: "/assistant", label: "ИИ-помощник" },
  { to: "/leaderboard", label: "Рейтинг" },
];

const TEACHER_NAV = [
  ...STUDENT_NAV,
  { to: "/teacher", label: "Кабинет преподавателя" },
];

const ADMIN_NAV = [
  { to: "/leaderboard", label: "Рейтинг" },
  { to: "/teacher", label: "Преподавателю" },
  { to: "/admin", label: "Админ" },
  { to: "/admin/teacher-applications", label: "Заявки преподавателей" },
];

export function AppNav() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const initial = (user?.email ?? "?").charAt(0).toUpperCase();

  const { data: teacherApplication } = useQuery({
    queryKey: ["nav-teacher-application", user?.id],
    enabled: !!user && !roles.includes("admin"),
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("teacher_applications")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as { status: string } | null;
    },
  });

  const effectiveNavItems = roles.includes("admin") ? ADMIN_NAV : roles.includes("teacher") || teacherApplication ? TEACHER_NAV : STUDENT_NAV;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to={roles.includes("admin") ? "/leaderboard" : "/dashboard"} className="flex items-center gap-2 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="text-lg tracking-tight">ОРТ Академия</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {effectiveNavItems.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground"
              activeProps={{ className: "active" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-10 gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">{initial}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium md:inline">{user?.email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                Профиль и настройки
              </DropdownMenuItem>
              {user && (
                <DropdownMenuItem onClick={() => navigate({ to: "/profile/$id", params: { id: user.id } })}>
                  Мой публичный профиль
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Выйти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((o) => !o)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
      {open && (
        <nav className="flex flex-col gap-1 border-t border-border/60 bg-background px-4 py-3 md:hidden">
          {effectiveNavItems.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground"
              activeProps={{ className: "active" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
