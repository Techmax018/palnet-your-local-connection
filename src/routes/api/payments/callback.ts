import { createFileRoute } from "@tanstack/react-router";

/** Legacy callback address still configured in PayHero; same verified handling. */
export const Route = createFileRoute("/api/payments/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = await request.json().catch(() => null);
        if (!payload) return Response.json({ ok: false }, { status: 400 });
        const { processMpesaCallback } = await import("@/lib/routerService");
        const result = await processMpesaCallback(payload as never);
        return Response.json({ ok: result.ok, message: result.message });
      },
    },
  },
});
