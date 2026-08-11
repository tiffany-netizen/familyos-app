// The dashboard follow-up queue (feedback round 3).
// GET  — seed any missing follow-up questions, return the next pending one.
// POST — record an answer or dismissal; for open-ended kinds, Claude turns
//        the answer into concrete next steps (todos + saved context).

import { createClient } from "@/lib/supabase/server";
import { aiEnabled, askClaude, extractJson } from "@/lib/ai";

type PersonRow = {
  id: string;
  name: string;
  relationship: string;
  nickname: string | null;
  interests: string | null;
};

async function seed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const [{ data: profile }, { data: people }, { data: routines }, { data: existing }] =
    await Promise.all([
      supabase.from("profiles").select("home_address").eq("id", userId).single(),
      supabase
        .from("people")
        .select("id,name,relationship,nickname,interests")
        .eq("owner_id", userId),
      supabase.from("routines").select("kind").eq("owner_id", userId),
      supabase.from("followups").select("kind,subject").eq("owner_id", userId),
    ]);

  const have = new Set((existing ?? []).map((f) => `${f.kind}:${f.subject ?? ""}`));
  const spouse = (people ?? []).find((p: PersonRow) => p.relationship === "spouse");
  const first = spouse?.name.split(" ")[0];
  const rows: Record<string, unknown>[] = [];
  const add = (kind: string, subject: string | null, question: string) => {
    if (!have.has(`${kind}:${subject ?? ""}`)) {
      rows.push({ owner_id: userId, kind, subject, question });
    }
  };

  if (spouse && !spouse.nickname) {
    add(
      "nickname",
      null,
      `Quick one: do you have a nickname you call ${first} — "babe", "love"? I'll use it whenever I draft a text. Or should I stick with "${first}"?`
    );
  }
  if (!profile?.home_address) {
    add(
      "address",
      null,
      "What city (or address) is home? I use it to point restaurant and shop suggestions at places actually near you."
    );
  }
  add(
    "weekend_activity",
    null,
    "Do you have any weekend activities you need or want reminders for?"
  );
  if (spouse) {
    add(
      "relationship",
      null,
      `Tell me a bit about how you and ${first} split things at home — kids, housework, the invisible stuff. Is there anything you'd like to take off ${first}'s plate?`
    );
  }
  add("trips", null, "Any trips coming up, work or personal? When and where?");
  if (spouse?.interests) {
    spouse.interests
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean)
      .slice(0, 4)
      .forEach((interest: string) => {
        add(
          "interest",
          interest,
          `You mentioned ${first} is into ${interest.toLowerCase()}. Anything you'd like to do for ${first} around that? Even something small counts.`
        );
      });
  }

  if (rows.length) await supabase.from("followups").insert(rows);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  await seed(supabase, user.id);

  const { data: next } = await supabase
    .from("followups")
    .select("id,kind,subject,question")
    .eq("owner_id", user.id)
    .eq("status", "pending")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  return Response.json({ followup: next ?? null });
}

const COACH_SYSTEM = `You are FamilyOS, a warm chief of staff for one family. The user just answered a follow-up question. Turn their answer into something actionable.

Return ONLY JSON:
{
  "reply": "2-3 warm sentences: acknowledge what they said and lay out the concrete plan you're setting up. Specific, never generic.",
  "todos": ["0-3 short to-do items phrased as actions the user takes this week"],
  "memory": "one sentence capturing the durable fact worth remembering, or null"
}

Keep todos genuinely doable this week ("Block Saturday 9am for Sarah's workout, you take the kids", "Grab a bottle of the Pinot she likes from Trader Joe's"). Use names and details from the context. No filler.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    id?: string;
    action?: string;
    answer?: string;
    data?: Record<string, unknown>;
  } = {};
  try {
    body = await request.json();
  } catch {}
  if (!body.id) return Response.json({ error: "missing id" }, { status: 400 });

  const { data: fu } = await supabase
    .from("followups")
    .select("*")
    .eq("id", body.id)
    .eq("owner_id", user.id)
    .single();
  if (!fu) return Response.json({ error: "not found" }, { status: 404 });

  if (body.action === "dismiss") {
    await supabase
      .from("followups")
      .update({ status: "dismissed", answered_at: new Date().toISOString() })
      .eq("id", fu.id);
    return Response.json({ ok: true });
  }

  const answer = String(body.answer ?? "").trim();
  let reply = "Saved.";

  if (fu.kind === "nickname") {
    const nick = answer.replace(/^["']|["']$/g, "").slice(0, 40);
    if (nick) {
      const { data: spouse } = await supabase
        .from("people")
        .select("id,name")
        .eq("owner_id", user.id)
        .eq("relationship", "spouse")
        .maybeSingle();
      if (spouse) {
        await supabase.from("people").update({ nickname: nick }).eq("id", spouse.id);
      }
      reply = `Got it. Every text I draft starts with "${nick}" from now on.`;
    }
  } else if (fu.kind === "address") {
    if (answer) {
      await supabase
        .from("profiles")
        .update({ home_address: answer.slice(0, 200) })
        .eq("id", user.id);
      reply = "Saved. Restaurant and shop suggestions will point near home now.";
    }
  } else if (fu.kind === "weekend_activity") {
    const d = body.data as
      | { label?: string; days?: number[]; time?: string; remind?: string }
      | undefined;
    if (d?.label && d.days?.length) {
      const dayTimes: Record<string, string> = {};
      if (d.time) d.days.forEach((n) => (dayTimes[String(n)] = d.time!));
      await supabase.from("routines").insert({
        owner_id: user.id,
        kind: "activity",
        label: d.label.slice(0, 80),
        days: [...d.days].sort().join(","),
        day_times: d.time ? dayTimes : null,
        notify: d.remind || null,
      });
      reply = `${d.label} is on the weekend radar. It'll show up in your brief on the right days.`;
    } else {
      reply = "No problem. You can add weekend activities anytime from the weekly update.";
    }
  } else if (fu.kind === "trips") {
    const d = body.data as
      | { kind?: string; destination?: string; start_date?: string; end_date?: string }
      | undefined;
    if (d?.destination) {
      await supabase.from("trips").insert({
        owner_id: user.id,
        kind: d.kind === "work" ? "work" : "family",
        destination: d.destination.slice(0, 120),
        start_date: d.start_date || null,
        end_date: d.end_date || d.start_date || null,
        notes: answer || null,
      });
      if (aiEnabled()) {
        try {
          const raw = await askClaude({
            system: COACH_SYSTEM,
            prompt: `Question asked: ${fu.question}\nThe user has a ${d.kind} trip to ${d.destination} from ${d.start_date} to ${d.end_date ?? d.start_date}. Extra notes: ${answer || "none"}.\n\nIf it's a work trip, plan how to ease the load on the family while they're away. If it's a family trip, plan how to make it more enjoyable.`,
            maxTokens: 800,
          });
          const out = extractJson<{ reply: string; todos: string[]; memory: string | null }>(raw);
          if (out?.reply) {
            reply = out.reply;
            if (out.todos?.length) {
              await supabase
                .from("todos")
                .insert(out.todos.slice(0, 3).map((t) => ({ owner_id: user.id, title: t })));
            }
          }
        } catch (e) {
          console.error("[followups/trip]", e);
          reply = `Trip to ${d.destination} saved. It'll show up in your brief as it gets close.`;
        }
      } else {
        reply = `Trip to ${d.destination} saved. It'll show up in your brief as it gets close.`;
      }
    } else {
      reply = "Noted, no trips on the horizon. I'll ask again down the road.";
    }
  } else {
    // relationship + interest: open-ended, AI turns the answer into steps
    if (answer && aiEnabled()) {
      try {
        const [{ data: people }, { data: profile }] = await Promise.all([
          supabase
            .from("people")
            .select("name,relationship,nickname,interests,works,job,stress_note")
            .eq("owner_id", user.id),
          supabase.from("profiles").select("full_name,home_address").eq("id", user.id).single(),
        ]);
        const raw = await askClaude({
          system: COACH_SYSTEM,
          prompt: `Family context: ${JSON.stringify({ profile, people })}\n\nQuestion asked: ${fu.question}\n\nUser's answer: """${answer}"""`,
          maxTokens: 800,
        });
        const out = extractJson<{ reply: string; todos: string[]; memory: string | null }>(raw);
        if (out?.reply) {
          reply = out.reply;
          if (out.todos?.length) {
            await supabase
              .from("todos")
              .insert(out.todos.slice(0, 3).map((t) => ({ owner_id: user.id, title: t })));
          }
          if (out.memory) {
            await supabase.from("memories").insert({
              owner_id: user.id,
              body: out.memory,
              category: "interest",
              source: "weekly_checkin",
            });
          }
        }
      } catch (e) {
        console.error("[followups/coach]", e);
        reply = "Saved. I'll fold that into how I plan for you.";
      }
    } else if (answer) {
      reply = "Saved. I'll fold that into how I plan for you.";
    }
  }

  await supabase
    .from("followups")
    .update({
      status: "answered",
      answer: answer || null,
      ai_response: reply,
      answered_at: new Date().toISOString(),
    })
    .eq("id", fu.id);

  return Response.json({ reply });
}
