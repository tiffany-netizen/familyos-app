"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      setError(result.error.message);
      setBusy(false);
      return;
    }
    router.push(mode === "signup" ? "/onboarding" : "/today");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-7 py-12">
      <h1 className="mb-1 text-3xl font-bold">
        {mode === "signup" ? "Join FamilyOS" : "Welcome back"}
      </h1>
      <p className="mb-8 text-sub">
        {mode === "signup"
          ? "Two minutes of setup, then it starts remembering for you."
          : "Good to see you again."}
      </p>

      <form onSubmit={submit} className="space-y-4">
        {mode === "signup" && (
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-xl border-[1.5px] border-line px-4 py-3 outline-none focus:border-brand"
          />
        )}
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className="w-full rounded-xl border-[1.5px] border-line px-4 py-3 outline-none focus:border-brand"
        />
        <input
          required
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-xl border-[1.5px] border-line px-4 py-3 outline-none focus:border-brand"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-xl bg-brand py-4 font-semibold text-white disabled:opacity-60"
        >
          {busy ? "One moment..." : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-sub">
        {mode === "signup" ? (
          <>
            Already a member?{" "}
            <Link href="/login" className="font-semibold text-brand">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="font-semibold text-brand">
              Create an account
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
