// POST /api/recipes/import — paste a recipe link, get a saved recipe.
// Most recipe sites embed schema.org/Recipe JSON-LD; we read that first.
// When a site doesn't, Claude reads the page text instead.

import { createClient } from "@/lib/supabase/server";
import { aiEnabled, askClaude, extractJson } from "@/lib/ai";

type Parsed = { title: string; ingredients: string[]; instructions: string[] };

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

// Walk any JSON-LD shape (@graph, arrays, nesting) looking for a Recipe node.
function findRecipeNode(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findRecipeNode(n);
      if (hit) return hit;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => typeof t === "string" && t.toLowerCase() === "recipe")) {
    return obj;
  }
  if (obj["@graph"]) return findRecipeNode(obj["@graph"]);
  return null;
}

function instructionsFrom(raw: unknown): string[] {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n) return;
    if (typeof n === "string") {
      const t = stripTags(n);
      if (t) out.push(t);
      return;
    }
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (typeof n === "object") {
      const o = n as Record<string, unknown>;
      if (typeof o.text === "string") {
        const t = stripTags(o.text);
        if (t) out.push(t);
      } else if (o.itemListElement) {
        walk(o.itemListElement);
      }
    }
  };
  walk(raw);
  return out;
}

function fromJsonLd(html: string): Parsed | null {
  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const m of scripts) {
    try {
      const data = JSON.parse(m[1].trim());
      const node = findRecipeNode(data);
      if (!node) continue;
      const title = typeof node.name === "string" ? stripTags(node.name) : "";
      const ingredients = (
        Array.isArray(node.recipeIngredient) ? node.recipeIngredient : []
      )
        .filter((i: unknown): i is string => typeof i === "string")
        .map(stripTags)
        .filter(Boolean);
      const instructions = instructionsFrom(node.recipeInstructions);
      if (title && ingredients.length) {
        return { title, ingredients, instructions };
      }
    } catch {
      continue;
    }
  }
  return null;
}

const AI_SYSTEM = `You extract recipes from web page text. Return ONLY JSON:
{"title":"...","ingredients":["1 lb ground beef","..."],"instructions":["step 1...","..."]}
Ingredients keep their quantities. If the text contains no actual recipe, return {"title":null}.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let url = "";
  try {
    const body = await request.json();
    url = String(body?.url ?? "").trim();
  } catch {}
  if (!/^https?:\/\//.test(url)) {
    return Response.json({ error: "That doesn't look like a link." }, { status: 400 });
  }

  let html = "";
  try {
    // A plain browser UA: many recipe sites 403 anything that announces
    // itself as a bot, and we only read the public page's recipe markup.
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    html = (await res.text()).slice(0, 600000);
  } catch (e) {
    console.error("[recipes/import] fetch", e);
    return Response.json(
      { error: "Couldn't reach that page. Check the link and try again." },
      { status: 502 }
    );
  }

  let parsed = fromJsonLd(html);

  if (!parsed && aiEnabled()) {
    try {
      const text = stripTags(
        html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      ).slice(0, 16000);
      const raw = await askClaude({
        system: AI_SYSTEM,
        prompt: `Page text from ${url}:\n\n${text}`,
        maxTokens: 1800,
      });
      const out = extractJson<{ title: string | null; ingredients?: string[]; instructions?: string[] }>(raw);
      if (out?.title && Array.isArray(out.ingredients) && out.ingredients.length) {
        parsed = {
          title: out.title,
          ingredients: out.ingredients.filter((i) => typeof i === "string"),
          instructions: (out.instructions ?? []).filter((i) => typeof i === "string"),
        };
      }
    } catch (e) {
      console.error("[recipes/import] ai fallback", e);
    }
  }

  if (!parsed) {
    return Response.json(
      { error: "No recipe found on that page." },
      { status: 422 }
    );
  }

  const { data: recipe, error } = await supabase
    .from("recipes")
    .insert({
      owner_id: user.id,
      title: parsed.title.slice(0, 200),
      url,
      ingredients: parsed.ingredients.slice(0, 60),
      instructions: parsed.instructions.slice(0, 40),
    })
    .select("id,title,url,ingredients,instructions,created_at")
    .single();
  if (error) {
    console.error("[recipes/import] insert", error);
    return Response.json({ error: "Couldn't save the recipe." }, { status: 500 });
  }

  return Response.json({ recipe });
}
