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
  {
    name: "save_memory",
    description:
      "Save one fact about this user's family into FamilyOS so it's remembered forever and used in briefs and planning (e.g. 'Kelly wants to try that new Thai place', 'Jackson's coach is Dave, 555-0100'). Name the person it's about when known. For gift ideas use save_gift_idea instead.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "the fact, in one sentence" },
        person: { type: "string", description: "first name of the family member it's about, if any" },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: "save_gift_idea",
    description:
      "Add a gift idea to the user's FamilyOS gift list for a specific person.",
    inputSchema: {
      type: "object",
      properties: {
        person: { type: "string", description: "first name of who the gift is for" },
        idea: { type: "string", description: "the gift idea" },
      },
      required: ["person", "idea"],
      additionalProperties: false,
    },
  },
  {
    name: "add_todo",
    description:
      "Add a to-do to the user's FamilyOS list (shows up on their To-dOS screen).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "the to-do, short and actionable" },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "import_known_context",
    description:
      "Bulk-import facts about this user's family that you already know from your own memory or this conversation (names, preferences, sizes, dates, traditions, places they love). Use when the user asks you to share or sync what you know about their family with FamilyOS. One fact per string.",
    inputSchema: {
      type: "object",
      properties: {
        facts: {
          type: "array",
          items: { type: "string" },
          description: "facts, one sentence each, max 50",
        },
      },
      required: ["facts"],
      additionalProperties: false,
    },
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
        "This user's FamilyOS family assistant. Use get_family_snapshot for a full picture; trust its precomputed day counts for dates. You can also write back: save_memory and save_gift_idea file new facts, add_todo adds tasks, and import_known_context bulk-syncs facts you already know about their family.",
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
      // Write tools. Person linking matches on first name, same as the app.
      const findPerson = async (first: unknown) => {
        if (!first || typeof first !== "string") return null;
        const { data: people } = await admin
          .from("people")
          .select("id,name")
          .eq("owner_id", prof.id);
        return (
          (people ?? []).find(
            (p) =>
              String(p.name ?? "").toLowerCase().split(" ")[0] ===
              first.toLowerCase().trim()
          ) ?? null
        );
      };
      const bustBrief = () =>
        admin
          .from("briefs")
          .delete()
          .eq("owner_id", prof.id)
          .eq("brief_date", new Date().toISOString().slice(0, 10));

      if (name === "save_memory") {
        const text = String(args.text ?? "").trim().slice(0, 500);
        if (!text) return rpcResult(rpc.id, textContent("Nothing to save."));
        const person = await findPerson(args.person);
        await admin.from("memories").insert({
          owner_id: prof.id,
          person_id: person?.id ?? null,
          body: text,
          category: "memory",
          source: "ai_connector",
        });
        await bustBrief();
        return rpcResult(
          rpc.id,
          textContent(
            `Saved${person ? ` and linked to ${person.name}` : ""}. FamilyOS will remember it.`
          )
        );
      }
      if (name === "save_gift_idea") {
        const idea = String(args.idea ?? "").trim().slice(0, 200);
        if (!idea) return rpcResult(rpc.id, textContent("No idea given."));
        const person = await findPerson(args.person);
        if (!person)
          return rpcResult(
            rpc.id,
            textContent(
              `Couldn't match "${String(args.person ?? "")}" to anyone in FamilyOS. Check get_family_snapshot for names.`
            )
          );
        await admin.from("gift_ideas").insert({
          owner_id: prof.id,
          person_id: person.id,
          title: idea,
          detail: "From an AI chat",
        });
        return rpcResult(rpc.id, textContent(`Gift idea saved for ${person.name}.`));
      }
      if (name === "add_todo") {
        const title = String(args.title ?? "").trim().slice(0, 200);
        if (!title) return rpcResult(rpc.id, textContent("No to-do given."));
        await admin.from("todos").insert({ owner_id: prof.id, title });
        return rpcResult(rpc.id, textContent("Added to the To-dOS list."));
      }
      if (name === "import_known_context") {
        const facts = Array.isArray(args.facts) ? args.facts.slice(0, 50) : [];
        const { data: people } = await admin
          .from("people")
          .select("id,name")
          .eq("owner_id", prof.id);
        const first = (n: string) => n.toLowerCase().split(" ")[0];
        let saved = 0;
        for (const f of facts) {
          const text = String(f ?? "").trim().slice(0, 500);
          if (!text) continue;
          const match =
            (people ?? []).find((p) =>
              new RegExp(`\\b${first(String(p.name ?? "x"))}\\b`, "i").test(text)
            ) ?? null;
          await admin.from("memories").insert({
            owner_id: prof.id,
            person_id: match?.id ?? null,
            body: text,
            category: "memory",
            source: "ai_connector",
          });
          saved++;
        }
        if (saved > 0) await bustBrief();
        return rpcResult(
          rpc.id,
          textContent(`Imported ${saved} fact${saved === 1 ? "" : "s"} into FamilyOS.`)
        );
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
