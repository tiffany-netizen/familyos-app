import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import ProfileForm from "@/components/ProfileForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name,birthday,home_address,date_night_frequency_days,sweet_text_optin,brief_email,wants_gift_lists,meal_notes,owns_home,brief_time"
    )
    .eq("id", user.id)
    .single();

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
      <ProfileForm
        initial={
          profile ?? {
            full_name: null,
            birthday: null,
            home_address: null,
            date_night_frequency_days: 14,
            sweet_text_optin: false,
            brief_email: true,
            wants_gift_lists: true,
            meal_notes: null,
            owns_home: null,
            brief_time: "07:00",
          }
        }
      />
      <BottomNav />
    </main>
  );
}
