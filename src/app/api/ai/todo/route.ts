// POST /api/ai/todo — makes the to-do list active instead of a dead
// checklist. Every new to-do gets enriched: category, implied due date,
// person link, a suggested first move, and ONE executable action (text
// link, calendar block, reservation search, local search, or in-app
// link). Sitter-related to-dos with no sitter on file also spawn a
// companion to-do to save the sitter's info for next time.

import { createClient } from "@/lib/supabase/server";
import { aiEnabled, askClaude, extractJson } from "@/lib/ai";

const SYSTEM = `You watch a family chief-of-staff app's to-do list. The user just added a to-do. Enrich it.

Return ONLY JSON with these fields:

"category": one of "call" | "buy" | "book" | "schedule" | "home" | "school" | "errand" | "other".

"due_date": "YYYY-MM-DD" or null. ONLY when the wording implies a deadline ("by Friday", "before the party", "tomorrow"). Use the TODAY date to resolve relative words. Never invent a deadline.

"person": first name of the family member this is about, from the PEOPLE list, or null.

"next_step": one short concrete first move (under 90 chars), or null when the to-do is its own first move.

"action": the ONE most useful executable action, or null. Shapes:
- {"kind":"sms","person":"Kelly","body":"short friendly draft message"} — for texting someone. Draft the actual message.
- {"kind":"calendar","title":"...","date":"YYYY-MM-DD","time":"HH:MM" or null,"duration_min":120} — for blocking time, reminders at a time, or anything that belongs on the calendar ("block Saturday 6-11", "text sitter Saturday morning" -> a Saturday 9:00 reminder titled "Text sitter pickup/dropoff times").
- {"kind":"reserve","query":"restaurant or cuisine + city"} — for restaurant reservations. Use HOME to pick the city.
- {"kind":"maps","query":"florist near Bend, OR","label":"Find local florists"} — for finding any local business (florist, barber, mechanic). Build the query from HOME.
- {"kind":"search","query":"live music Bend OR Saturday August 29","label":"See what's on"} — a web search for events, showtimes, availability, anything time-and-place. Build the query from HOME and the resolved date.
- {"kind":"link","path":"/sitter","label":"Open the sitter brief"} — when the app already does it. Paths: "/sitter" sitter brief, "/meals" meal planning, "/digest" week view, "/people" family profiles, "/home-hub" home services + service providers.
Pick calendar over sms when the to-do is about doing something AT a time; pick sms when the point is the message itself.

"question": ONE short conditional follow-up for the dashboard, ONLY when completing the to-do would naturally produce something the app should remember (new person -> People, a date -> tracked dates, a place/gift/preference -> memories, recurring duty -> routines). Plain to-dos: null.`;

const KINDS = ["sms", "calendar", "reserve", "maps", "search", "link"];
const CATS = ["call", "buy", "book", "schedule", "home", "school", "errand", "other"];
const PATHS = ["/sitter", "/meals", "/digest", "/people", "/home-hub", "/todos", "/gifts"];

type Action = {
  kind?: string;
  person?: string;
  body?: string;
  title?: string;
  date?: string;
  time?: string;
  duration_min?: number;
  query?: string;
  label?: string;
  path?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!aiEnabled()) return Response.json({ queued: false });

  let title = "";
  let id = "";
  try {
    const body = await request.json();
    title = String(body?.title ?? "").trim();
    id = String(body?.id ?? "").trim();
  } catch {}
  if (!title) return Response.json({ queued: false });

  try {
    const [{ data: people }, { data: profile }, { data: sitters }] = await Promise.all([
      supabase.from("people").select("id,name,phone").eq("owner_id", user.id),
      supabase.from("profiles").select("home_address").eq("id", user.id).single(),
      supabase
        .from("service_providers")
        .select("id")
        .eq("owner_id", user.id)
        .eq("kind", "babysitter")
        .limit(1),
    ]);
    const names = (people ?? [])
      .map((p) => String(p.name ?? "").split(" ")[0])
      .filter(Boolean);

    const today = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
    );
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const weekday = today.toLocaleDateString("en-US", { weekday: "long" });

    const raw = await askClaude({
      system: SYSTEM,
      prompt: `TODAY: ${todayStr} (${weekday})\nPEOPLE: ${names.join(", ") || "none"}\nHOME: ${profile?.home_address ?? "unknown"}\nTo-do just added: "${title}"`,
      maxTokens: 500,
    });
    const out = extractJson<{
      category?: string | null;
      due_date?: string | null;
      person?: string | null;
      next_step?: string | null;
      action?: Action | null;
      question?: string | null;
    }>(raw);

    const findPerson = (first?: string | null) =>
      first
        ? (people ?? []).find(
            (p) =>
              String(p.name ?? "").toLowerCase().split(" ")[0] ===
              String(first).toLowerCase()
          ) ?? null
        : null;

    // Write the enrichment onto the row.
    if (id && out) {
      const patch: Record<string, unknown> = {};
      if (out.category && CATS.includes(out.category)) patch.category = out.category;
      if (out.due_date && /^\d{4}-\d{2}-\d{2}$/.test(out.due_date) && out.due_date >= todayStr)
        patch.due_date = out.due_date;
      const linked = findPerson(out.person);
      if (linked) patch.person_id = linked.id;
      if (out.next_step && typeof out.next_step === "string")
        patch.next_step = out.next_step.slice(0, 120);

      // Validate and store the action.
      const a = out.action;
      if (a && typeof a === "object" && a.kind && KINDS.includes(a.kind)) {
        let payload: Record<string, unknown> | null = null;
        if (a.kind === "sms") {
          const target = findPerson(a.person);
          payload = {
            name: a.person ?? null,
            phone: (target?.phone as string | null) ?? null,
            body: typeof a.body === "string" ? a.body.slice(0, 300) : null,
          };
        } else if (a.kind === "calendar") {
          if (a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date)) {
            payload = {
              title: (a.title ?? title).slice(0, 120),
              date: a.date,
              time: a.time && /^\d{1,2}:\d{2}$/.test(a.time) ? a.time : null,
              duration_min:
                typeof a.duration_min === "number" && a.duration_min > 0
                  ? Math.min(a.duration_min, 720)
                  : 60,
            };
          }
        } else if (a.kind === "reserve" || a.kind === "maps" || a.kind === "search") {
          if (a.query)
            payload = {
              query: String(a.query).slice(0, 120),
              label: a.label ? String(a.label).slice(0, 40) : null,
            };
        } else if (a.kind === "link") {
          if (a.path && PATHS.includes(a.path))
            payload = {
              path: a.path,
              label: a.label ? String(a.label).slice(0, 40) : null,
            };
        }
        if (payload) {
          patch.action_kind = a.kind;
          patch.action_payload = payload;
        }
      }
      if (Object.keys(patch).length) {
        await supabase.from("todos").update(patch).eq("id", id).eq("owner_id", user.id);
      }
    }

    // Sitter mentioned but nobody on file: the app should close that loop.
    if (/\bsitter\b|\bbabysit/i.test(title) && (sitters ?? []).length === 0) {
      const companion = "Save the sitter's name and number for next time";
      const { data: dupe } = await supabase
        .from("todos")
        .select("id")
        .eq("owner_id", user.id)
        .eq("done", false)
        .eq("title", companion)
        .maybeSingle();
      if (!dupe) {
        await supabase.from("todos").insert({
          owner_id: user.id,
          title: companion,
          category: "other",
          next_step: "Add them under service providers so the sitter brief fills itself in",
          action_kind: "link",
          action_payload: { path: "/home-hub", label: "Add the sitter" },
        });
      }
    }

    if (out?.question && typeof out.question === "string") {
      const { data: existing } = await supabase
        .from("followups")
        .select("id")
        .eq("owner_id", user.id)
        .eq("kind", "todo")
        .eq("subject", title.slice(0, 120))
        .maybeSingle();
      if (!existing) {
        await supabase.from("followups").insert({
          owner_id: user.id,
          kind: "todo",
          subject: title.slice(0, 120),
          question: out.question.slice(0, 300),
        });
      }
      return Response.json({ queued: true, enriched: true });
    }
    return Response.json({ queued: false, enriched: true });
  } catch (e) {
    console.error("[ai/todo]", e);
  }
  return Response.json({ queued: false });
}
