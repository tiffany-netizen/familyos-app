import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import ProfileForm from "@/components/ProfileForm";
import CalendarConnect from "@/components/CalendarConnect";
import ConnectAi from "@/components/ConnectAi";
import { googleEnabled } from "@/lib/google";
import { TourReplay } from "@/components/FeatureTour";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ calendar?: string; slot?: string }>;
}) {
  const { calendar, slot } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: gTokens }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "full_name,birthday,home_address,phone,brief_notes,date_night_frequency_days,sweet_text_optin,brief_email,wants_gift_lists,meal_notes,owns_home,brief_time,grocery_store,time_format"
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("google_tokens")
      .select("slot,email")
      .eq("owner_id", user.id),
  ]);

  const personalToken = (gTokens ?? []).find((t) => t.slot === "personal");
  const workToken = (gTokens ?? []).find((t) => t.slot === "work");

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-8">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your profile</h1>
        <Link
          href="/today"
          className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-sub"
        >
          ‹ Today
        </Link>
      </div>
      <p className="mb-6 text-sm text-sub">
        As FamilyOS learns to track new things, the new fields show up here, so
        you never have to redo setup.
      </p>
      <div className="mb-3 space-y-3">
        <CalendarConnect
          slot="personal"
          label="Personal calendar"
          connectedEmail={personalToken?.email ?? (personalToken ? "your Google account" : null)}
          available={googleEnabled()}
          status={slot === "personal" ? calendar : undefined}
        />
        <CalendarConnect
          slot="work"
          label="Work calendar"
          connectedEmail={workToken?.email ?? (workToken ? "your Google account" : null)}
          available={googleEnabled()}
          status={slot === "work" ? calendar : undefined}
        />
      </div>
      <div className="mb-6">
        <ConnectAi />
      </div>
      <ProfileForm
        initial={
          profile ?? {
            full_name: null,
            birthday: null,
            home_address: null,
            phone: null,
            brief_notes: null,
            date_night_frequency_days: 14,
            sweet_text_optin: false,
            brief_email: true,
            wants_gift_lists: true,
            meal_notes: null,
            owns_home: null,
            brief_time: "07:00",
            grocery_store: null,
            time_format: "12h",
          }
        }
      />
      <TourReplay />
      <BottomNav />
    </main>
  );
}
