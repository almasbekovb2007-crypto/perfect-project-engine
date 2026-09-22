import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async (ctx) => {
  const { next } = ctx;

  // Server function calls must NOT be wrapped with an HTML error page —
  // TanStack Start serialises their errors as JSON and the client expects
  // that format. Returning HTML here would make the client throw a
  // non-Error object, hiding the real error message.
  if ((ctx as { handlerType?: string }).handlerType === "serverFn") {
    return next();
  }

  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
