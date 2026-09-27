import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { authorizeRequest } from "../access.server";
import { AccessError } from "../access-policy";
import { DeploymentError, createRpc, loadFactoryConfig } from "./chain";
import { prepareDeployment, bindSubmission, reconcileDeployment } from "./lifecycle";

/** Read-only preparation and evidence reconciliation. The founder signs externally. */
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const prepare = z.object({
  action: z.literal("prepare"),
  ventureId: z.string().uuid(),
  creator: address, template: hash, version: z.number().int().positive().max(4294967295),
  owner: address, guardian: address, parent: address, asset: address,
  cap: z.string().regex(/^[0-9]{1,78}$/),
  approvalReference: z.string().trim().min(8).max(500),
}).strict();
const bind = z.object({ action: z.literal("bind"), deploymentId: z.string().uuid(), transactionHash: hash }).strict();
const reconcile = z.object({ action: z.literal("reconcile"), deploymentId: z.string().uuid() }).strict();
const inputSchema = z.discriminatedUnion("action", [prepare, bind, reconcile]);
function json(body: unknown, status = 200): Response {
  return Response.json(body, {status, headers:{"Cache-Control":"no-store"}});
}
export async function deploymentHandler(request: Request): Promise<Response> {
  try {
    const actor = await authorizeRequest(request, "operator");
    if (dbSource !== "neon") return json({error:"PERSISTENT_DATABASE_REQUIRED"},503);
    const db = await getSql();
    if (request.method === "GET") {
      const id = new URL(request.url).searchParams.get("id");
      if (id && !z.string().uuid().safeParse(id).success) return json({error:"INVALID_ID"},400);
      if (id) {
        const rows = await db.query("SELECT * FROM deployment_requests WHERE id=$1 LIMIT 1",[id]);
        return rows.length ? json({deployment:rows[0]}) : json({error:"NOT_FOUND"},404);
      }
      const rows = await db.query("SELECT id,venture_id,state,chain_id,expected_address,transaction_hash,created_at,updated_at FROM deployment_requests ORDER BY created_at DESC LIMIT 50");
      return json({deployments:rows});
    }
    if (request.method !== "POST") return json({error:"METHOD_NOT_ALLOWED"},405);
    const text = await request.text();
    if (text.length > 16384) return json({error:"BODY_TOO_LARGE"},413);
    let input: z.infer<typeof inputSchema>;
    try { input = inputSchema.parse(JSON.parse(text)); }
    catch { return json({error:"INVALID_REQUEST"},400); }
    const config = loadFactoryConfig();
    const endpoints = [process.env.BASE_RPC_URL,process.env.BASE_RPC_FALLBACK_URL].filter((x):x is string=>Boolean(x));
    const rpc = createRpc(db,endpoints);
    if (input.action === "prepare") {
      const result=await prepareDeployment(db,rpc,config,input,actor.id);
      return json({ ...result, note:"PREPARED_ONLY: no transaction submitted; founder-controlled signing is required." });
    }
    if (input.action === "bind") return json(await bindSubmission(db,rpc,input.deploymentId,input.transactionHash));
    return json(await reconcileDeployment(db,rpc,config,input.deploymentId));
  } catch(error) {
    if(error instanceof AccessError) return json({error:"ACCESS_DENIED"},error.status);
    if(error instanceof DeploymentError) return json({error:error.message},error.status);
    return json({error:"DEPLOYMENT_SERVICE_UNAVAILABLE"},503);
  }
}
