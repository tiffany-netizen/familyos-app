// POST /api/ai/datenight — Claude plans date night from everything the app
// knows: sitter on file, city, kids' ages, spouse tastes, saved gift ideas.
// Returns a practical considerations checklist the UI renders with actions.

import { createClient } from "@/lib/supabase/server";
import { aiEnabled, askClaude, extractJson } from "@/lib/ai";
import { gatherFacts } from "@/lib/facts";

type PlanItem = {
  title: string;
  detail: string;
  link?: string;
  todo?: string;
};
type Plan = { considerations: PlanItem[] };

const SYSTEM = `You are FamilyOS, a practical chief of staff. The user wants to take their partner on a date night. Using the family snapshot, produce the full considerations list so the night goes off without a hitch.

Cover what applies: babysitter (use the sitter on file by name if there is one), reservation (OpenTable link https://www.opentable.com/s?covers=2&term=<city> using home_address city), timing around kids' routines, transportation, whether a gift or flowers fit (check gift_ideas and favorite_flowers), what their partner is into (use interests and memories, e.g. a wine bar for a wine lover), and anything date-specific from tracked dates. Be concrete: names, times, places. No fluff.

For anything happening in the world (live music, events, showtimes, florists near home), attach a real search link: https://www.google.com/search?q=<url-encoded query like "live music Bend OR Saturday August 29"> or a Google Maps search https://www.google.com/maps/search/<query>. Build queries from home_address city and the actual date.

Return ONLY JSON:
{
  "considerations": [
    {
      "title": "3-6 word imperative, e.g. 'Lock in Maria for Saturday'",
      "detail": "1-2 practical sentences using real names and facts from the snapshot",
      "link": "https:// link if one truly helps (OpenTable, google search), else omit",
      "todo": "short to-do phrasing if this is actionable this week, else omit"
    }
  ]
}
6 to 10 items, ordered by what to lock down first.`;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!aiEnabled()) return Response.json({ error: "ai disabled" }, { status: 503 });

  try {
    const facts = await gatherFacts(supabase, user.id);
    const text = await askClaude({
      system: SYSTEM,
      prompt: `Today is ${facts.weekday}, ${facts.today}. Family snapshot:\n\n${JSON.stringify(facts)}`,
      maxTokens: 1500,
    });
    const plan = extractJson<Plan>(text);
    if (!plan?.considerations?.length)
      return Response.json({ error: "no plan" }, { status: 502 });

    const considerations = plan.considerations
      .slice(0, 10)
      .filter((c) => typeof c?.title === "string" && typeof c?.detail === "string")
      .map((c) => ({
        title: c.title,
        detail: c.detail,
        link: typeof c.link === "string" && /^https:\/\//.test(c.link) ? c.link : undefined,
        todo: typeof c.todo === "string" ? c.todo : undefined,
      }));

    return Response.json({ considerations });
  } catch (e) {
    console.error("[ai/datenight]", e);
    return Response.json({ error: "failed" }, { status: 502 });
  }
}
