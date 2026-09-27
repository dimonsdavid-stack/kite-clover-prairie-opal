import { createFileRoute } from "@tanstack/react-router";
import { deploymentHandler } from "@/lib/arclenos/deployment/service.server";
export const Route = createFileRoute("/api/v1/factory/deployments")({
  server: { handlers: { GET: ({request}) => deploymentHandler(request), POST: ({request}) => deploymentHandler(request) } },
});
