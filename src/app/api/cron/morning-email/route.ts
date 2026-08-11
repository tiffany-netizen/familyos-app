// GET /api/cron/morning-email — fired by Vercel Cron each morning.
// For every onboarded user with brief_email on: build (or reuse) today's
// AI brief and send it. Uses the service role key, so it must stay locked
// behind CRON_SECRET.

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { aiEnabled } from "@/lib/ai";
import { gatherFacts } from "@/lib/facts";
import { generateAiBrief } from "@/lib/aiBrief";
import { buildBrief, type BriefItem, type Trip } from "@/lib/brief";
import { renderBriefEmail, sendEmail } from "@/lib/email";

export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY not set" }, { status: 500 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false } }
  );

  const today = new Date().toISOString().slice(0, 10);
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const { data: profiles } = await admin
    .from("profiles")
    .select("id,full_name,brief_email,onboarded")
    .eq("onboarded", true)
    .eq("brief_email", true);

  const results: { user: string; status: string }[] = [];

  for (const p of profiles ?? []) {
    try {
      // Already sent today?
      const { data: existing } = await admin
        .from("briefs")
        .select("id,intro,items,email_sent_at")
        .eq("owner_id", p.id)
        .eq("brief_date", today)
        .maybeSingle();
      if (existing?.email_sent_at) {
        results.push({ user: p.id, status: "already sent" });
        continue;
      }

      const { data: authUser } = await admin.auth.admin.getUserById(p.id);
      const email = authUser?.user?.email;
      if (!email) {
        results.push({ user: p.id, status: "no email" });
        continue;
      }

      // Build the brief: cached AI > fresh AI > rule-based
      let intro: string | null = existing?.intro ?? null;
      let items: BriefItem[] = (existing?.items as BriefItem[]) ?? [];

      if (!existing) {
        const facts = await gatherFacts(admin, p.id);
        if (aiEnabled()) {
          try {
            const ai = await generateAiBrief(facts);
            if (ai) {
              intro = ai.intro;
              items = ai.items;
            }
          } catch (e) {
            console.error("[cron] ai brief failed", p.id, e);
          }
        }
        if (items.length === 0) {
          items = buildBrief(
            facts.people as Parameters<typeof buildBrief>[0],
            facts.tracked_dates as Parameters<typeof buildBrief>[1],
            facts.home_items as Parameters<typeof buildBrief>[2],
            new Date(),
            facts.routines as Parameters<typeof buildBrief>[4],
            facts.profile,
            facts.trips as Trip[]
          );
        }
      }

      if (items.length === 0) {
        results.push({ user: p.id, status: "nothing to send" });
        continue;
      }

      const firstName = (p.full_name || "there").split(" ")[0];
      const html = renderBriefEmail(firstName, dateLabel, intro, items);
      await sendEmail(email, `Your Family Brief · ${dateLabel}`, html);

      await admin.from("briefs").upsert(
        {
          owner_id: p.id,
          brief_date: today,
          intro,
          items,
          email_sent_at: new Date().toISOString(),
        },
        { onConflict: "owner_id,brief_date" }
      );

      results.push({ user: p.id, status: "sent" });
    } catch (e) {
      console.error("[cron] failed for", p.id, e);
      results.push({ user: p.id, status: "error" });
    }
  }

  return Response.json({ date: today, results });
}
