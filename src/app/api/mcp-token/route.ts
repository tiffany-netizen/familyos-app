// POST /api/mcp-token — mint (or rotate) the signed-in user's personal
// AI connector URL. DELETE revokes it.

import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
  const { error } = await supabase
    .from("profiles")
    .update({ mcp_token: token })
    .eq("id", user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const origin = new URL(request.url).origin;
  return Response.json({ url: `${origin}/api/mcp/${token}` });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  await supabase.from("profiles").update({ mcp_token: null }).eq("id", user.id);
  return Response.json({ ok: true });
}
