import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const redirectTo = (() => {
        if (!location) return "/";
        if (typeof location === "string") return location;
        if (typeof location.href === "string") return location.href;
        if (typeof location.toString === "function") {
          try {
            const value = location.toString();
            if (typeof value === "string") return value;
          } catch {
            // ignore
          }
        }
        const pathname = typeof location.pathname === "string" ? location.pathname : "";
        const search = typeof location.search === "string" ? location.search : "";
        const hash = typeof location.hash === "string" ? location.hash : "";
        return pathname + search + hash || "/";
      })();
      throw redirect({
        to: "/auth",
        search: { mode: "login", redirect: redirectTo } as never,
      });
    }
  },
  component: () => (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  ),
});
