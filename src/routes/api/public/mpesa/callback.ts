import { createFileRoute } from "@tanstack/react-router";

/**
 * PayHero (Lipwa) M-Pesa callback. Confirms payment, creates the subscription and
 * authorizes the device on its router.
 */
export const Route = createFileRoute("/api/public/mpesa/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ ResultCode: 1, ResultDesc: "Invalid payload" }, { status: 400 });
        }

        const { processMpesaCallback } = await import("@/lib/routerService");
        await processMpesaCallback(payload as never).catch(() => null);
        // Same reply for every request so callers cannot probe payment references.
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
