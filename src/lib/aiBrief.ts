// The Claude-written morning brief. Reads the user's facts and returns
// the same shape the Today screen already renders, plus a warm intro line.
// Falls back to the rule-based brief upstream if anything goes wrong.

import { askClaude, extractJson } from "@/lib/ai";
import type { Facts } from "@/lib/facts";
import type { BriefAction, BriefItem } from "@/lib/brief";

export type AiBrief = { intro: string; items: BriefItem[] };

const SYSTEM = `You are FamilyOS, a warm and observant chief of staff for one family. You write the user's morning brief.

You get a JSON snapshot of everything the app knows: people (with nicknames, interests, jobs, stress notes), tracked dates, routines with weekday numbers (0=Sunday..6=Saturday), home maintenance, trips, sports events, saved memories, gift ideas, and answers the user gave to follow-up questions.

Write today's brief. Rules:

- 3 to 6 items, most important first. Only include what matters TODAY or needs planning ahead. Skip anything with no hook today.
- Include: today's routines (school run, dinner duty, weekend activities with their time), birthdays within 30 days, tracked dates within their lead_time_days, call gaps of 10+ days (people with relationship parent or friend, using last_contact), home maintenance due within 14 days (last_performed + frequency_days), trips starting within 14 days, and today's sports events.
- If sweet_text_optin is true and today feels right (roughly once a week, weekdays), include a sweet-text nudge for the spouse using their nickname if set, referencing their stress_note or job when relevant.
- Weave in remembered details naturally ("she mentioned...", "he's into..."). That observant touch is the product.
- Dinner duty items should suggest one specific easy dinner idea and include a recipe link (google search URL for that dish) and a groceries link (https://www.instacart.com/store).
- Anniversary or date-night items should include an OpenTable link: https://www.opentable.com/s?covers=2&term=<city from home_address if known, else omit term>.
- Work trips: suggest one concrete way to ease the load on the family while away. Family trips: suggest one way to make it more fun.
- Do NOT include open to-dos (the app shows those separately). Do not invent people, dates, or facts not in the snapshot.

Return ONLY JSON, no prose around it:
{
  "intro": "one short warm sentence for the top of the brief",
  "items": [
    {
      "icon": "one emoji",
      "text": "1-2 sentences, plain and warm, no corporate tone",
      "meta": "role · context, e.g. 'dad · today's checklist'",
      "role": "dad|husband|son|home|friend|personal",
      "actions": [
        {"label": "...", "kind": "confirm", "payload": "short confirmation text", "primary": true},
        {"label": "...", "kind": "sms", "payload": "the text message to draft"},
        {"label": "...", "kind": "link", "href": "https://..."},
        {"label": "We talked", "kind": "we_talked", "personId": "uuid of the person"}
      ]
    }
  ]
}

Action rules: 1-3 actions per item, exactly one with "primary": true. kind must be one of confirm, sms, link, we_talked. Use we_talked (with the person's id from the snapshot) for call-gap items. Use sms for anything the user would text someone. confirm payload is what the app replies after the tap.`;

const VALID_KINDS = new Set(["confirm", "sms", "link", "we_talked"]);

function sanitize(raw: AiBrief | null): AiBrief | null {
  if (!raw || typeof raw.intro !== "string" || !Array.isArray(raw.items)) return null;
  const items: BriefItem[] = [];
  for (const it of raw.items.slice(0, 6)) {
    if (!it || typeof it.text !== "string") continue;
    const actions: BriefAction[] = [];
    for (const a of (it.actions ?? []).slice(0, 3)) {
      if (!a || typeof a.label !== "string" || !VALID_KINDS.has(a.kind)) continue;
      if (a.kind === "link" && !/^https:\/\//.test(a.href ?? "")) continue;
      actions.push({
        label: a.label,
        kind: a.kind,
        payload: typeof a.payload === "string" ? a.payload : undefined,
        href: typeof a.href === "string" ? a.href : undefined,
        personId: typeof a.personId === "string" ? a.personId : undefined,
        primary: Boolean(a.primary),
      });
    }
    items.push({
      icon: typeof it.icon === "string" ? it.icon.slice(0, 8) : "•",
      text: it.text,
      meta: typeof it.meta === "string" ? it.meta : "",
      role: typeof it.role === "string" ? it.role : "personal",
      actions,
    });
  }
  if (items.length === 0) return null;
  return { intro: raw.intro, items };
}

export async function generateAiBrief(facts: Facts): Promise<AiBrief | null> {
  const text = await askClaude({
    system: SYSTEM,
    prompt: `Today is ${facts.weekday}, ${facts.today}. Here is the family snapshot:\n\n${JSON.stringify(
      facts
    )}`,
    maxTokens: 2500,
  });
  return sanitize(extractJson<AiBrief>(text));
}
