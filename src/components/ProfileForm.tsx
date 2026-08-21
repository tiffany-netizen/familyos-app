"use client";

// Edit your own profile. Any new profile field we add to the app gets a
// control here so existing users can fill it in without redoing onboarding.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AddressField from "@/components/AddressField";

type Profile = {
  full_name: string | null;
  birthday: string | null;
  home_address: string | null;
  date_night_frequency_days: number | null;
  sweet_text_optin: boolean | null;
  brief_email: boolean | null;
  wants_gift_lists: boolean | null;
  meal_notes: string | null;
  owns_home: boolean | null;
  brief_time: string | null;
};

function Chip({
  on,
  children,
  onClick,
}: {
  on: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border-[1.5px] px-4 py-2.5 text-sm ${
        on ? "border-brand bg-brand-soft font-semibold" : "border-line bg-white"
      }`}
    >
      {children}
    </button>
  );
}

export default function ProfileForm({ initial }: { initial: Profile }) {
  const router = useRouter();
  const [name, setName] = useState(initial.full_name ?? "");
  const [birthday, setBirthday] = useState(initial.birthday ?? "");
  const [address, setAddress] = useState(initial.home_address ?? "");
  const [dateNight, setDateNight] = useState(
    initial.date_night_frequency_days ?? 14
  );
  const [sweetText, setSweetText] = useState(Boolean(initial.sweet_text_optin));
  const [briefEmail, setBriefEmail] = useState(initial.brief_email !== false);
  const [giftLists, setGiftLists] = useState(initial.wants_gift_lists !== false);
  const [mealNotes, setMealNotes] = useState(initial.meal_notes ?? "");
  const [ownsHome, setOwnsHome] = useState<boolean | null>(initial.owns_home);
  const [briefTime, setBriefTime] = useState(initial.brief_time ?? "07:00");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You're signed out. Sign in and try again.");
      setBusy(false);
      return;
    }
    const { error: e } = await supabase
      .from("profiles")
      .update({
        full_name: name.trim() || null,
        birthday: birthday || null,
        home_address: address.trim() || null,
        date_night_frequency_days: dateNight,
        sweet_text_optin: sweetText,
        brief_email: briefEmail,
        wants_gift_lists: giftLists,
        meal_notes: mealNotes.trim() || null,
        owns_home: ownsHome,
        brief_time: briefTime || "07:00",
      })
      .eq("id", user.id);
    if (e) {
      setError(e.message);
      setBusy(false);
      return;
    }
    // Profile changes shape the brief; toss today's cached one.
    await supabase
      .from("briefs")
      .delete()
      .eq("owner_id", user.id)
      .eq("brief_date", new Date().toISOString().slice(0, 10));
    setBusy(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sub">
          Your name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border-[1.5px] border-line px-4 py-3 outline-none focus:border-brand"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sub">
          Your birthday
        </span>
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          className="w-full rounded-xl border-[1.5px] border-line px-4 py-3 outline-none focus:border-brand"
        />
      </label>

      <AddressField
        label="Home address"
        value={address}
        onChange={setAddress}
        placeholder="Start typing your address..."
        hint="Pick from the suggestions. Used for restaurants, sitters, and plans near you. Never shared."
      />

      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sub">
          Date night, ideally
        </span>
        <div className="flex gap-2">
          {[
            { l: "Weekly", d: 7 },
            { l: "Every 2 weeks", d: 14 },
            { l: "Monthly", d: 30 },
          ].map((o) => (
            <Chip key={o.d} on={dateNight === o.d} onClick={() => setDateNight(o.d)}>
              {o.l}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sub">
          Weekly sweet-text nudge
        </span>
        <div className="flex gap-2">
          <Chip on={sweetText} onClick={() => setSweetText(true)}>On</Chip>
          <Chip on={!sweetText} onClick={() => setSweetText(false)}>Off</Chip>
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sub">
          Morning brief email
        </span>
        <div className="flex gap-2">
          <Chip on={briefEmail} onClick={() => setBriefEmail(true)}>On</Chip>
          <Chip on={!briefEmail} onClick={() => setBriefEmail(false)}>Off</Chip>
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sub">
          Brief arrival time
        </span>
        <input
          type="time"
          value={briefTime}
          onChange={(e) => setBriefTime(e.target.value)}
          className="w-full rounded-xl border-[1.5px] border-line px-4 py-3 outline-none focus:border-brand"
        />
        <span className="mt-1.5 block text-[13px] text-sub">
          Email currently goes out at 7:00 AM ET; this takes over as delivery
          windows roll out.
        </span>
      </label>

      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sub">
          Own or rent your home
        </span>
        <div className="flex gap-2">
          <Chip on={ownsHome === true} onClick={() => setOwnsHome(true)}>Own</Chip>
          <Chip on={ownsHome === false} onClick={() => setOwnsHome(false)}>Rent</Chip>
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sub">
          Family food rules
        </span>
        <textarea
          value={mealNotes}
          onChange={(e) => setMealNotes(e.target.value)}
          placeholder="No shellfish, Emma won't touch mushrooms, taco night always works..."
          className="min-h-20 w-full rounded-xl border-[1.5px] border-line p-4 outline-none focus:border-brand"
        />
      </label>

      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sub">
          Keep gift idea lists
        </span>
        <div className="flex gap-2">
          <Chip on={giftLists} onClick={() => setGiftLists(true)}>Yes</Chip>
          <Chip on={!giftLists} onClick={() => setGiftLists(false)}>No</Chip>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={save}
        disabled={busy}
        className="w-full rounded-xl bg-brand py-4 font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving..." : saved ? "✓ Saved" : "Save profile"}
      </button>
    </div>
  );
}
