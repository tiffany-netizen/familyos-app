"use client";

// "Connect your AI": mints a personal MCP connector URL so the user's
// Claude or ChatGPT account can read their FamilyOS data in any chat.
// The URL is a secret; rotating it kills the old one instantly.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ConnectAi() {
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("profiles")
          .select("mcp_token")
          .eq("id", user.id)
          .single();
        if (data?.mcp_token) setToken(data.mcp_token);
      } catch {
        // Column not migrated yet on this database; the card still renders.
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const url = token ? `${window.location.origin}/api/mcp/${token}` : null;

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch("/api/mcp-token", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data?.url) setToken(String(data.url).split("/api/mcp/")[1] ?? null);
    } catch {}
    setBusy(false);
  }

  async function revoke() {
    setBusy(true);
    try {
      await fetch("/api/mcp-token", { method: "DELETE" });
      setToken(null);
    } catch {}
    setBusy(false);
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (!loaded) return null;

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-sub">
        Connect your AI
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        Give Claude or ChatGPT a window into your FamilyOS memory. Ask
        &quot;what&apos;s coming up for my family&quot; or &quot;gift ideas
        for the kids&quot; in any chat and it answers from your real data.
        Read-only.
      </p>

      {!token && (
        <button
          onClick={generate}
          disabled={busy}
          className="mt-3 rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Creating..." : "Create my connector link"}
        </button>
      )}

      {token && url && (
        <>
          <div className="mt-3 break-all rounded-xl border border-line bg-background p-3 font-mono text-[11px] text-sub">
            {url}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={copy}
              className="rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button
              onClick={generate}
              disabled={busy}
              className="rounded-lg bg-blue-soft px-3.5 py-2.5 text-[13px] font-semibold text-blue-ink disabled:opacity-60"
            >
              Rotate
            </button>
            <button
              onClick={revoke}
              disabled={busy}
              className="rounded-lg px-3 py-2.5 text-[13px] font-semibold text-sub disabled:opacity-60"
            >
              Disconnect
            </button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-sub">
            In Claude: Settings, Connectors, Add custom connector, paste the
            link. In ChatGPT: Settings, Connectors (developer mode), add the
            link. Treat it like a password; Rotate kills the old link if it
            ever leaks. Works on the live site.
          </p>
        </>
      )}
    </div>
  );
}
