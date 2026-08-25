// POST /api/ai/memory — true memory parsing.
// Handles multi-person notes, notes with no name at all, and classification
// into memory / gift idea / interest / plan. The client falls back to the
// old first-name splitter if this route fails.

import { createClient } from "@/lib/supabase/server";
import { aiEnabled, askClaude, extractJson } from "@/lib/ai";

type Filing = {
  person_id: string | null;
  person_name: string | null;
  category: "memory" | "gift_idea" | "interest" | "plan";
  body: string;
  gift_title?: string;
  routine?: {
    label: string;
    days: number[];
    time: string | null;
    duration_min: number | null;
  } | null;
};

const SYSTEM = `You file family notes for FamilyOS. You get one note the user typed or spoke, plus their list of people (id, name, relationship, nickname).

Split the note into one filing per fact. For each filing decide:
- person_id: the matching person's id. Match first names, nicknames ("my wife", "mom", "the dog") and possessives to the right person using relationships. If the note names anyone from the people list, person_id MUST be that person's id. null is a last resort for notes about no one specific.
- category: "gift_idea" if it's something they want, mentioned wanting, saved, or would love to receive; "interest" for a like/hobby/preference; "plan" for something to do or book; otherwise "memory".
- body: the fact, rewritten as a clean standalone sentence.
- gift_title: for gift_idea only, a short title for the gift list ("KitchenAid mixer").
- routine: when the note describes a RECURRING weekly schedule (practices, lessons, classes, standing commitments with weekdays), also return {"label": "Baseball practice - Jackson", "days": [1,3], "time": "17:00", "duration_min": 60}. days use 0=Sunday..6=Saturday. time is 24h "HH:MM" in the timezone stated in the note, or null if none given. duration_min from a stated range (5-6pm = 60), else null. Include a location in the label if the note names one ("Baseball practice - Jackson (Bend)"). Otherwise omit routine or set it null. A one-off event is NOT a routine.

Return ONLY a JSON array of filings, nothing else. Example:
[{"person_id":"...","category":"gift_idea","body":"Sarah mentioned she wants a KitchenAid mixer.","gift_title":"KitchenAid mixer"}]`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  if (!aiEnabled()) return Response.json({ source: "disabled" }, { status: 503 });

  let text = "";
  try {
    const body = await request.json();
    text = String(body?.text ?? "").trim();
  } catch {}
  if (!text) return Response.json({ error: "empty" }, { status: 400 });

  const { data: people } = await supabase
    .from("people")
    .select("id,name,relationship,nickname")
    .eq("owner_id", user.id);

  try {
    const raw = await askClaude({
      system: SYSTEM,
      prompt: `People:\n${JSON.stringify(people ?? [])}\n\nNote:\n"""${text}"""`,
      maxTokens: 1200,
    });
    const filings = extractJson<Filing[]>(raw);
    if (!filings || !Array.isArray(filings) || filings.length === 0) {
      return Response.json({ source: "error" }, { status: 502 });
    }

    const validIds = new Set((people ?? []).map((p) => p.id));
    const nameById = new Map((people ?? []).map((p) => [p.id, p.name]));
    const results: { person: string; filedAs: string }[] = [];
    let routineProposal: Filing["routine"] = null;

    for (const f of filings.slice(0, 8)) {
      if (!f.body) continue;
      let personId = f.person_id && validIds.has(f.person_id) ? f.person_id : null;
      // Safety net: if the model didn't link a person but the sentence
      // names one, attach the match ourselves. "Jackson has baseball..."
      // must land on Jackson's file, never General.
      if (!personId) {
        const bodyLower = f.body.toLowerCase();
        for (const p of people ?? []) {
          const first = p.name.split(" ")[0].toLowerCase();
          if (!first) continue;
          const esc = first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          if (new RegExp(`\\b${esc}\\b`).test(bodyLower)) {
            personId = p.id;
            break;
          }
        }
      }
      const category = ["memory", "gift_idea", "interest", "plan"].includes(f.category)
        ? f.category
        : "memory";

      await supabase.from("memories").insert({
        owner_id: user.id,
        person_id: personId,
        body: f.body,
        category,
        source: "note",
      });

      if (category === "gift_idea" && personId) {
        await supabase.from("gift_ideas").insert({
          owner_id: user.id,
          person_id: personId,
          title: f.gift_title || f.body,
          detail: "From a saved note",
        });
      }

      // First schedule spotted wins; the client confirms before anything
      // is added to the week.
      if (
        !routineProposal &&
        f.routine &&
        typeof f.routine.label === "string" &&
        Array.isArray(f.routine.days) &&
        f.routine.days.some((n) => Number.isInteger(n) && n >= 0 && n <= 6)
      ) {
        routineProposal = {
          label: f.routine.label.slice(0, 80),
          days: f.routine.days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
          time:
            typeof f.routine.time === "string" && /^\d{2}:\d{2}$/.test(f.routine.time)
              ? f.routine.time
              : null,
          duration_min:
            typeof f.routine.duration_min === "number" ? f.routine.duration_min : null,
        };
      }

      results.push({
        person: personId ? (nameById.get(personId) ?? "General").split(" ")[0] : "General",
        filedAs:
          category === "gift_idea"
            ? "Gift ideas"
            : category === "interest"
              ? "Interests"
              : category === "plan"
                ? "Plans"
                : "Memories",
      });
    }

    return Response.json({ source: "ai", filings: results, routine: routineProposal });
  } catch (e) {
    console.error("[ai/memory]", e);
    return Response.json({ source: "error" }, { status: 502 });
  }
}
