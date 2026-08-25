// FamilyOS as an MCP server. Claude and ChatGPT both accept custom
// connectors that speak MCP over streamable HTTP; this endpoint lets a
// user's own AI chats read their FamilyOS data (read-only) through a
// personal secret URL generated on the profile page.
//
// Needs the service role key, so it runs in production only; staging
// previews answer 503.

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { gatherFacts } from "@/lib/facts";

export const maxDuration = 60;

type Rpc = {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
};

const TOOLS = [
  {
    name: "get_family_snapshot",
    description:
      "Everything FamilyOS knows about this user's family today: people (with birthdays, interests, sizes, allergies, teachers), tracked dates with day counts, routines, trips, home maintenance, saved memories, gift ideas, service providers, and upcoming calendar events. Call this first for any question about the family.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_memories",
    description:
      "Search the user's saved FamilyOS memories (things like 'she mentioned wanting hiking boots'). Returns matching notes newest first.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "text to search for" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_gift_ideas",
    description: "The user's open gift idea list, with who each idea is for.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

function rpcResult(id: Rpc["id"], result: unknown) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result });
}
function rpcError(id: Rpc["id"], code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}
function textContent(text: string) {
  return { content: [{ type: "text", text }] };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return Response.json(
      { error: "connector available on production only" },
      { status: 503 }
    );
  }
  if (!token || token.length < 20) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false } }
  );
  const { data: prof } = await admin
    .from("profiles")
    .select("id,full_name")
    .eq("mcp_token", token)
    .maybeSingle();
  if (!prof) return Response.json({ error: "unauthorized" }, { status: 401 });

  let rpc: Rpc = {};
  try {
    rpc = (await request.json()) as Rpc;
  } catch {
    return rpcError(null, -32700, "parse error");
  }
  const method = rpc.method ?? "";

  if (method.startsWith("notifications/")) return new Response(null, { status: 202 });

  if (method === "initialize") {
    const requested = (rpc.params?.protocolVersion as string) || "2025-06-18";
    return rpcResult(rpc.id, {
      protocolVersion: requested,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "FamilyOS", version: "1.0.0" },
      instructions:
        "Read-only view of this user's FamilyOS family data. Use get_family_snapshot for a full picture; trust its precomputed day counts for dates.",
    });
  }
  if (method === "ping") return rpcResult(rpc.id, {});
  if (method === "tools/list") return rpcResult(rpc.id, { tools: TOOLS });

  if (method === "tools/call") {
    const name = rpc.params?.name as string;
    const args = (rpc.params?.arguments ?? {}) as Record<string, unknown>;
    try {
      if (name === "get_family_snapshot") {
        const facts = await gatherFacts(admin, prof.id);
        // The AI on the other end doesn't need internal plumbing.
        const { suppressed_keys, recent_sms_drafts, ...rest } = facts;
        void suppressed_keys;
        void recent_sms_drafts;
        return rpcResult(rpc.id, textContent(JSON.stringify(rest)));
      }
      if (name === "search_memories") {
        const q = String(args.query ?? "").slice(0, 100);
        if (!q) return rpcResult(rpc.id, textContent("[]"));
        const { data } = await admin
          .from("memories")
          .select("body,category,created_at")
          .eq("owner_id", prof.id)
          .ilike("body", `%${q}%`)
          .order("created_at", { ascending: false })
          .limit(20);
        return rpcResult(rpc.id, textContent(JSON.stringify(data ?? [])));
      }
      if (name === "list_gift_ideas") {
        const [{ data: gifts }, { data: people }] = await Promise.all([
          admin
            .from("gift_ideas")
            .select("title,status,person_id,created_at")
            .eq("owner_id", prof.id)
            .eq("status", "idea"),
          admin.from("people").select("id,name").eq("owner_id", prof.id),
        ]);
        const byId = new Map((people ?? []).map((p) => [p.id, p.name]));
        const out = (gifts ?? []).map((g) => ({
          idea: g.title,
          for: g.person_id ? (byId.get(g.person_id) ?? null) : null,
          saved: g.created_at,
        }));
        return rpcResult(rpc.id, textContent(JSON.stringify(out)));
      }
      return rpcError(rpc.id, -32602, `unknown tool: ${name}`);
    } catch (e) {
      console.error("[mcp]", e);
      return rpcResult(rpc.id, {
        content: [{ type: "text", text: "Tool failed. Try again." }],
        isError: true,
      });
    }
  }

  return rpcError(rpc.id, -32601, `method not found: ${method}`);
}

export async function GET() {
  return Response.json(
    {
      name: "FamilyOS MCP connector",
      hint: "Add this URL as a custom connector in Claude or ChatGPT; it speaks MCP over POST.",
    },
    { status: 405 }
  );
}
