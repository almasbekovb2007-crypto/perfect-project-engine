import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { BrainCircuit, GraduationCap, LineChart, ShieldCheck, Sparkles, Target, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "ОРТ Академия — онлайн-подготовка к ОРТ" },
      { name: "description", content: "Современная платформа для подготовки к ОРТ: курсы, тесты, работа над ошибками и ИИ-помощник." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="text-lg">ОРТ Академия</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost">Войти</Button>
          </Link>
          <Link to="/auth" search={{ mode: "signup" } as never}>
            <Button>Начать бесплатно</Button>
          </Link>
        </div>
      </header>

      <section className="container mx-auto px-6 pb-20 pt-12 md:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Подготовка с ИИ-помощником
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">
              Подготовься к <span className="bg-clip-text text-transparent gradient-hero">ОРТ</span> в своём ритме
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Учебные материалы, онлайн-тесты с авто-проверкой, раздел «Мои ошибки» и
              персональный ИИ-помощник, который объясняет решения и составляет план подготовки.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" search={{ mode: "signup" } as never}>
                <Button size="lg" className="h-12 px-6 text-base shadow-soft">
                  Создать аккаунт
                </Button>
              </Link>
              <Link to="/leaderboard">
                <Button size="lg" variant="outline" className="h-12 px-6 text-base">
                  Посмотреть рейтинг
                </Button>
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6 border-t border-border pt-6">
              <Stat label="Предметов" value="4+" />
              <Stat label="Заданий" value="1000+" />
              <Stat label="Активных учеников" value="100+" />
            </div>
          </div>

          <div className="relative">
            <div className="rounded-3xl gradient-card border border-border p-8 shadow-glow">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">ИИ-помощник</div>
                  <div className="text-xs text-muted-foreground">подбирает темы и объясняет</div>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <Bubble role="user">Не понимаю задачи на проценты в ОРТ</Bubble>
                <Bubble role="ai">
                  Давай разберём шаг за шагом. Проценты — это…
                  <div className="mt-2 text-xs text-muted-foreground">Рекомендую курс «Проценты и пропорции» и 5 тестов на 30 минут.</div>
                </Bubble>
                <Bubble role="user">Составь план на неделю</Bubble>
                <Bubble role="ai">Готово ✨ — открыл план в дашборде.</Bubble>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-6 py-16">
        <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">Всё, что нужно для подготовки</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Структурированные курсы, контроль знаний и геймификация — в одной платформе.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Feature icon={<GraduationCap />} title="Курсы и материалы" desc="Темы по предметам ОРТ от опытных преподавателей." />
          <Feature icon={<Target />} title="Онлайн-тесты" desc="Авто-проверка, статистика и анализ результатов." />
          <Feature icon={<LineChart />} title="Прогресс и графики" desc="Визуализация роста по темам и предметам." />
          <Feature icon={<BrainCircuit />} title="Работа над ошибками" desc="Каждый неверный вопрос сохраняется до закрепления." />
          <Feature icon={<Trophy />} title="Рейтинг" desc="Сравнивайте достижения с другими абитуриентами." />
          <Feature icon={<ShieldCheck />} title="Приватность" desc="Сами решаете, открыт ли ваш профиль." />
        </div>
      </section>

      <section className="container mx-auto px-6 pb-24">
        <div className="rounded-3xl gradient-hero p-10 text-primary-foreground shadow-glow">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-2xl font-bold md:text-3xl">Начни подготовку уже сегодня</h3>
              <p className="mt-2 max-w-xl text-primary-foreground/80">
                Регистрация занимает минуту. ИИ-помощник и первые тесты бесплатны.
              </p>
            </div>
            <Link to="/auth" search={{ mode: "signup" } as never}>
              <Button size="lg" variant="secondary" className="h-12 px-6 text-base">
                Зарегистрироваться
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} ОРТ Академия. Все права защищены.
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-bold md:text-3xl">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-soft">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function Bubble({ role, children }: { role: "user" | "ai"; children: React.ReactNode }) {
  return (
    <div className={role === "user" ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          role === "user"
            ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2 text-sm text-primary-foreground"
            : "max-w-[80%] rounded-2xl rounded-tl-sm bg-secondary px-4 py-2 text-sm"
        }
      >
        {children}
      </div>
    </div>
  );
}

// keep unused import safe-guarded
void Users;
