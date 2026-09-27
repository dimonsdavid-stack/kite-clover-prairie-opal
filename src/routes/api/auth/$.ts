import { createFileRoute } from "@tanstack/react-router";
async function handle(request: Request) {
  if (process.env.NODE_ENV === "production" && (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_URL || (process.env.BETTER_AUTH_SECRET?.length ?? 0) < 32)) {
    return Response.json({ error: "AUTH_NOT_CONFIGURED" }, { status: 503 });
  }
  const { auth } = await import("@/lib/auth/server");
  return auth.handler(request);
}
export const Route = createFileRoute("/api/auth/$")({ server: { handlers: {
  GET: ({ request }) => handle(request), POST: ({ request }) => handle(request),
} } });
