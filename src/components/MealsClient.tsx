"use client";

// The recipe box and shopping list. Paste a link, ingredients get pulled,
// tap them onto a checkbox shopping list. Food rules feed the AI's dinner
// suggestions in the brief.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

type Recipe = {
  id: string;
  title: string;
  url: string | null;
  ingredients: string[];
  instructions: string[];
};

type Item = { id: string; name: string; done: boolean; recipe_id: string | null };

function domainOf(url: string | null): string {
  if (!url) return "saved by hand";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

export default function MealsClient({
  initialRecipes,
  initialItems,
  mealNotes,
}: {
  initialRecipes: Recipe[];
  initialItems: Item[];
  mealNotes: string;
}) {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [rules, setRules] = useState(mealNotes);
  const [rulesSaved, setRulesSaved] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  async function importRecipe() {
    const u = url.trim();
    if (!u) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.recipe) {
        setImportError(data?.error ?? "Couldn't read that page.");
      } else {
        setRecipes((r) => [data.recipe, ...r]);
        setOpenId(data.recipe.id);
        setUrl("");
      }
    } catch {
      setImportError("Something went wrong. Try again.");
    }
    setImporting(false);
  }

  async function addToList(names: string[], recipeId: string | null) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const existing = new Set(items.filter((i) => !i.done).map((i) => i.name.toLowerCase()));
    const fresh = names.filter((n) => n.trim() && !existing.has(n.trim().toLowerCase()));
    if (!fresh.length) return;
    const { data } = await supabase
      .from("shopping_items")
      .insert(fresh.map((name) => ({ owner_id: user.id, name: name.trim(), recipe_id: recipeId })))
      .select("id,name,done,recipe_id");
    if (data) setItems((it) => [...it, ...data]);
    router.refresh();
  }

  async function toggleItem(item: Item) {
    setItems((it) => it.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    const supabase = createClient();
    await supabase.from("shopping_items").update({ done: !item.done }).eq("id", item.id);
  }

  async function clearChecked() {
    const done = items.filter((i) => i.done).map((i) => i.id);
    if (!done.length) return;
    setItems((it) => it.filter((i) => !i.done));
    const supabase = createClient();
    await supabase.from("shopping_items").delete().in("id", done);
  }

  async function deleteRecipe(id: string) {
    setRecipes((r) => r.filter((x) => x.id !== id));
    const supabase = createClient();
    await supabase.from("recipes").delete().eq("id", id);
    router.refresh();
  }

  async function saveRules() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ meal_notes: rules.trim() || null })
      .eq("id", user.id);
    // Meal rules shape the brief; drop today's cached one.
    await supabase
      .from("briefs")
      .delete()
      .eq("owner_id", user.id)
      .eq("brief_date", new Date().toISOString().slice(0, 10));
    setRulesSaved(true);
    setTimeout(() => setRulesSaved(false), 2500);
  }

  const openItems = items.filter((i) => !i.done);
  const doneItems = items.filter((i) => i.done);

  return (
    <div className="space-y-7">
      {/* Import */}
      <div className="rounded-2xl border border-line bg-white p-4">
        <p className="text-sm font-bold">Add a recipe</p>
        <div className="mt-2.5 flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a recipe link"
            inputMode="url"
            className="min-w-0 flex-1 rounded-lg border-[1.5px] border-line px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
          <button
            onClick={importRecipe}
            disabled={importing || !url.trim()}
            className="rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {importing ? "Reading..." : "Import"}
          </button>
        </div>
        {importing && (
          <p className="mt-2 text-[13px] font-medium text-blue-ink">
            Pulling ingredients and steps from the page...
          </p>
        )}
        {importError && (
          <p className="mt-2 text-[13px] font-medium text-red-600">{importError}</p>
        )}
      </div>

      {/* Shopping list */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-sub">
            Shopping list
          </h2>
          <a
            href="https://www.instacart.com/store"
            target="_blank"
            rel="noreferrer"
            className="text-[13px] font-semibold text-blue-ink"
          >
            Order on Instacart ›
          </a>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          {openItems.length === 0 && doneItems.length === 0 && (
            <p className="text-sm text-sub">
              Empty. Open a recipe below and tap ingredients onto the list, or
              add items here.
            </p>
          )}
          <div className="space-y-1.5">
            {[...openItems, ...doneItems].map((i) => (
              <button
                key={i.id}
                onClick={() => toggleItem(i)}
                className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left text-sm"
              >
                <span
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-[1.5px] ${
                    i.done ? "border-brand bg-brand text-white" : "border-line"
                  }`}
                >
                  {i.done ? "✓" : ""}
                </span>
                <span className={i.done ? "text-sub line-through" : ""}>{i.name}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newItem.trim()) {
                  addToList([newItem], null);
                  setNewItem("");
                }
              }}
              placeholder="Add an item"
              className="min-w-0 flex-1 rounded-lg border-[1.5px] border-line px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button
              onClick={() => {
                if (newItem.trim()) {
                  addToList([newItem], null);
                  setNewItem("");
                }
              }}
              className="rounded-lg bg-blue-soft px-3.5 py-2 text-[13px] font-semibold text-blue-ink"
            >
              Add
            </button>
            {doneItems.length > 0 && (
              <button
                onClick={clearChecked}
                className="rounded-lg px-2 py-2 text-[13px] font-semibold text-sub"
              >
                Clear checked
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recipe box */}
      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-sub">
          Recipe box
        </h2>
        {recipes.length === 0 ? (
          <p className="text-sm text-sub">
            No recipes yet. Paste a link above; the ingredients and steps get
            pulled in automatically.
          </p>
        ) : (
          <div className="space-y-2.5">
            {recipes.map((r) => {
              const open = openId === r.id;
              return (
                <div key={r.id} className="rounded-2xl border border-line bg-white">
                  <button
                    onClick={() => {
                      setOpenId(open ? null : r.id);
                      setShowSteps(false);
                    }}
                    className="flex w-full items-center gap-3 p-4 text-left"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-line bg-background text-brand">
                      <Icon name="pan" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{r.title}</p>
                      <p className="text-xs text-sub">
                        {domainOf(r.url)} · {r.ingredients.length} ingredients
                      </p>
                    </div>
                    <span className="text-sub">{open ? "▾" : "›"}</span>
                  </button>
                  {open && (
                    <div className="border-t border-line px-4 pb-4">
                      <button
                        onClick={() => addToList(r.ingredients, r.id)}
                        className="mt-3 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white"
                      >
                        Add all to shopping list
                      </button>
                      <ul className="mt-3 space-y-1">
                        {r.ingredients.map((ing, i) => (
                          <li key={i} className="flex items-start justify-between gap-2 text-sm">
                            <span>{ing}</span>
                            <button
                              onClick={() => addToList([ing], r.id)}
                              className="flex-shrink-0 text-[13px] font-semibold text-blue-ink"
                            >
                              + list
                            </button>
                          </li>
                        ))}
                      </ul>
                      {r.instructions.length > 0 && (
                        <button
                          onClick={() => setShowSteps((s) => !s)}
                          className="mt-3 text-[13px] font-semibold text-blue-ink"
                        >
                          {showSteps ? "Hide steps" : `Show steps (${r.instructions.length})`}
                        </button>
                      )}
                      {showSteps && (
                        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
                          {r.instructions.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      )}
                      <div className="mt-3 flex items-center justify-between">
                        {r.url ? (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[13px] font-semibold text-sub"
                          >
                            Open original ›
                          </a>
                        ) : (
                          <span />
                        )}
                        <button
                          onClick={() => deleteRecipe(r.id)}
                          className="text-[13px] font-semibold text-red-500"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Food rules */}
      <div className="rounded-2xl border border-line bg-white p-4">
        <button
          onClick={() => setRulesOpen((o) => !o)}
          className="flex w-full items-center justify-between text-left"
        >
          <p className="text-sm font-bold">Family food rules</p>
          <span className="text-sub">{rulesOpen ? "▾" : "›"}</span>
        </button>
        {!rulesOpen && rules.trim() && (
          <p className="mt-1 truncate text-[13px] text-sub">{rules}</p>
        )}
        {rulesOpen && (
          <>
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              placeholder="No shellfish, taco night always works..."
              className="mt-2 min-h-20 w-full rounded-xl border-[1.5px] border-line p-3 text-sm outline-none focus:border-brand"
            />
            <button
              onClick={saveRules}
              className="mt-2 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white"
            >
              {rulesSaved ? "✓ Saved" : "Save rules"}
            </button>
            <p className="mt-1.5 text-xs text-sub">
              Dinner suggestions in your brief follow these.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
