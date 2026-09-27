import { createFileRoute } from "@tanstack/react-router";
import { handleCommerceRequest } from "@/lib/arclenos/commerce/service.server";
export const Route = createFileRoute("/api/v1/pricing")({server:{handlers:{GET:({request})=>handleCommerceRequest(request),POST:({request})=>handleCommerceRequest(request)}}});
