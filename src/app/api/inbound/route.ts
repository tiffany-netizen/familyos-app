// POST /api/inbound — replies to the morning brief email land here.
// Resend's inbound webhook posts received emails; we match the sender to a
// FamilyOS account and file whatever they wrote through the same AI memory
// pipeline as the in-app note box. "Reply to your brief with updates."
//
// Setup required (one time): an inbound domain in Resend pointing its
// webhook at https://<site>/api/inbound?secret=<INBOUND_SECRET>, plus the
// INBOUND_SECRET env var. Until then this route just sits idle.

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { aiEnabled, askClaude, extractJson } from "@/lib/ai";

export const maxDuration = 60;

type Filing = {
  person_id: string | null;
  category: "memory" | "gift_idea" | "interest" | "plan";
  body: string;
  gift_title?: string;
};

const SYSTEM = `You file family notes for FamilyOS. You get one note the user emailed in (a reply to their morning brief), plus their list of people (id, name, relationship, nickname). Quoted text from the original email may be included; IGNORE everything after a line starting with ">" or "On ... wrote:".

Split the new text into one filing per fact. For each filing decide:
- person_id: the matching person's id, or null if about no one specific.
- category: "gift_idea" for wants/wishes, "interest" for likes, "plan" for something to do or book, otherwise "memory".
- body: the fact as a clean standalone sentence.
- gift_title: for gift_idea only, a short title.

Return ONLY a JSON array of filings.`;

// Strip quoted reply tails so only the user's new words get filed.
function newTextOnly(text: string): string {
  const lines = text.split("\n");
  const keep: string[] = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) break;
    if (/^On .{5,80}wrote:\s*$/.test(line.trim())) break;
    if (/^-{2,}\s*Original Message/i.test(line.trim())) break;
    keep.push(line);
  }
  return keep.join("\n").trim();
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.INBOUND_SECRET;
  if (!secret || url.searchParams.get("secret") !== secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return Response.json({ error: "no service key" }, { status: 503 });

  let payload: {
    type?: string;
    data?: { from?: string; text?: string; subject?: string };
  } = {};
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "bad payload" }, { status: 400 });
  }

  const fromRaw = payload.data?.from ?? "";
  const fromEmail = (fromRaw.match(/<([^>]+)>/)?.[1] ?? fromRaw).trim().toLowerCase();
  const text = newTextOnly(String(payload.data?.text ?? ""));
  if (!fromEmail || !text) return Response.json({ ok: true, filed: 0 });

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  });

  // Match the sender to an account.
  const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = userList?.users?.find(
    (u) => (u.email ?? "").toLowerCase() === fromEmail
  );
  if (!user) return Response.json({ ok: true, filed: 0, reason: "unknown sender" });

  if (!aiEnabled()) return Response.json({ ok: true, filed: 0, reason: "ai off" });

  const { data: people } = await admin
    .from("people")
    .select("id,name,relationship,nickname")
    .eq("owner_id", user.id);

  try {
    const raw = await askClaude({
      system: SYSTEM,
      prompt: `People:\n${JSON.stringify(people ?? [])}\n\nEmailed note:\n"""${text.slice(0, 4000)}"""`,
      maxTokens: 1200,
    });
    const filings = extractJson<Filing[]>(raw) ?? [];
    const validIds = new Set((people ?? []).map((p) => p.id));
    let filed = 0;
    for (const f of filings.slice(0, 8)) {
      if (!f.body) continue;
      const personId = f.person_id && validIds.has(f.person_id) ? f.person_id : null;
      const category = ["memory", "gift_idea", "interest", "plan"].includes(f.category)
        ? f.category
        : "memory";
      await admin.from("memories").insert({
        owner_id: user.id,
        person_id: personId,
        body: f.body,
        category,
        source: "email_reply",
      });
      if (category === "gift_idea" && personId) {
        await admin.from("gift_ideas").insert({
          owner_id: user.id,
          person_id: personId,
          title: f.gift_title || f.body,
          detail: "From an email reply",
        });
      }
      filed++;
    }
    // The brief may want to reflect what just came in.
    if (filed > 0) {
      const today = new Date().toISOString().slice(0, 10);
      await admin.from("briefs").delete().eq("owner_id", user.id).eq("brief_date", today);
    }
    return Response.json({ ok: true, filed });
  } catch (e) {
    console.error("[inbound]", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
