import { createFileRoute } from "@tanstack/react-router";

/**
 * Safaricom Daraja STK callback. Confirms payment, creates the subscription and
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
        const result = await processMpesaCallback(payload as never);

        return Response.json({
          ResultCode: result.ok ? 0 : 1,
          ResultDesc: result.message,
        });
      },
    },
  },
});
