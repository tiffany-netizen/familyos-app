// POST /api/ai/todo — makes the to-do list active instead of a dead
// checklist. When a new to-do implies something FamilyOS should capture
// ("find a babysitter" -> that sitter belongs in the database), a
// follow-up question is queued for the dashboard.

import { createClient } from "@/lib/supabase/server";
import { aiEnabled, askClaude, extractJson } from "@/lib/ai";

const SYSTEM = `You watch a family chief-of-staff app's to-do list. The user just added a to-do. Decide if completing it would naturally produce something the app should remember:

- a new person (babysitter, coach, doctor, friend) -> they belong in the People database
- a date or occasion -> belongs in tracked dates
- a place, gift idea, or preference -> belongs in memories/gifts
- a recurring duty -> belongs in weekly routines

If yes, write ONE short conditional follow-up question to show on the dashboard later, e.g. for "find a babysitter": "Sitter hunt still on? When you land one, tell me their name and I'll keep them on file for date nights." Ground it in the actual to-do. If the to-do is plain (buy milk, call plumber once), no follow-up.

Return ONLY JSON: {"question": "..." or null}`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!aiEnabled()) return Response.json({ queued: false });

  let title = "";
  try {
    const body = await request.json();
    title = String(body?.title ?? "").trim();
  } catch {}
  if (!title) return Response.json({ queued: false });

  try {
    const raw = await askClaude({
      system: SYSTEM,
      prompt: `To-do just added: "${title}"`,
      maxTokens: 300,
    });
    const out = extractJson<{ question: string | null }>(raw);
    if (out?.question && typeof out.question === "string") {
      // One follow-up per to-do title; skip if an identical one exists.
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
      return Response.json({ queued: true });
    }
  } catch (e) {
    console.error("[ai/todo]", e);
  }
  return Response.json({ queued: false });
}
