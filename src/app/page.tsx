import Link from "next/link";

const features = [
  {
    title: "🧠 Remembers everything",
    body: "Birthdays, teachers, sizes, gift ideas your wife mentioned in passing.",
  },
  {
    title: "📅 Thinks weeks ahead",
    body: "Your anniversary planning starts three weeks out, on its own.",
  },
  {
    title: "✅ Suggests the next action",
    body: "Never just a reminder. Book the table, order the flowers, send the text.",
  },
];

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-7 py-12">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-3xl">
        🏡
      </div>
      <h1 className="mb-3 text-4xl font-bold">FamilyOS</h1>
      <p className="mb-8 text-lg leading-relaxed text-sub">
        A chief of staff for your family life. It remembers the details, plans
        ahead, and suggests the next step so nothing slips.
      </p>

      <div className="space-y-4">
        {features.map((f) => (
          <div key={f.title} className="border-l-[3px] border-brand-soft pl-4">
            <p className="font-semibold">{f.title}</p>
            <p className="text-sm leading-relaxed text-sub">{f.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-10">
        <Link
          href="/signup"
          className="block w-full rounded-xl bg-brand py-4 text-center font-semibold text-white"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="mt-2 block w-full py-3 text-center text-sm font-medium text-sub"
        >
          Already a member? Sign in
        </Link>
      </div>
    </main>
  );
}
