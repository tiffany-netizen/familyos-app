// POST /api/ai/brief — generate (or return today's cached) AI-written brief.
// The Today page renders the rule-based brief instantly; a client component
// calls this to upgrade it. Cached one per day in the briefs table.

import { createClient } from "@/lib/supabase/server";
import { aiEnabled } from "@/lib/ai";
import { gatherFacts } from "@/lib/facts";
import { generateAiBrief } from "@/lib/aiBrief";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  if (!aiEnabled()) {
    return Response.json({ source: "disabled" });
  }

  let force = false;
  try {
    const body = await request.json();
    force = Boolean(body?.force);
  } catch {}

  const today = new Date().toISOString().slice(0, 10);

  if (!force) {
    const { data: cached } = await supabase
      .from("briefs")
      .select("intro,items")
      .eq("owner_id", user.id)
      .eq("brief_date", today)
      .maybeSingle();
    if (cached) {
      return Response.json({ source: "cache", ...cached });
    }
  }

  try {
    const facts = await gatherFacts(supabase, user.id);
    const brief = await generateAiBrief(facts);
    if (!brief) return Response.json({ source: "error" }, { status: 502 });

    await supabase.from("briefs").upsert(
      {
        owner_id: user.id,
        brief_date: today,
        intro: brief.intro,
        items: brief.items,
      },
      { onConflict: "owner_id,brief_date" }
    );

    return Response.json({ source: "ai", ...brief });
  } catch (e) {
    console.error("[ai/brief]", e);
    return Response.json({ source: "error" }, { status: 502 });
  }
}
