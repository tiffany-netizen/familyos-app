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
};

const SYSTEM = `You file family notes for FamilyOS. You get one note the user typed or spoke, plus their list of people (id, name, relationship, nickname).

Split the note into one filing per fact. For each filing decide:
- person_id: the matching person's id. Match first names, nicknames ("my wife", "mom", "the dog") and possessives to the right person using relationships. null only if it's truly about no one specific.
- category: "gift_idea" if it's something they want, mentioned wanting, saved, or would love to receive; "interest" for a like/hobby/preference; "plan" for something to do or book; otherwise "memory".
- body: the fact, rewritten as a clean standalone sentence.
- gift_title: for gift_idea only, a short title for the gift list ("KitchenAid mixer").

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

    for (const f of filings.slice(0, 8)) {
      if (!f.body) continue;
      const personId = f.person_id && validIds.has(f.person_id) ? f.person_id : null;
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

    return Response.json({ source: "ai", filings: results });
  } catch (e) {
    console.error("[ai/memory]", e);
    return Response.json({ source: "error" }, { status: 502 });
  }
}
