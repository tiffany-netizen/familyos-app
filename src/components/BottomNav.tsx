"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/today", label: "Today", icon: "☀️" },
  { href: "/people", label: "People", icon: "👨‍👩‍👧" },
  { href: "/todos", label: "To-dos", icon: "✅" },
  { href: "/home-hub", label: "Home", icon: "🏡" },
  { href: "/gifts", label: "Gifts", icon: "🎁" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md">
        {tabs.map((t) => {
          const active = path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11.5px] font-semibold ${
                active ? "text-brand" : "text-sub"
              }`}
            >
              <span
                className={`text-lg ${active ? "" : "opacity-70 grayscale-[35%]"}`}
              >
                {t.icon}
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
