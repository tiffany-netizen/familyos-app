"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";

// The OS suffix marks the database sections; Today and To-dos are the
// action surfaces. "HomeOS" also stops the house tab reading as a
// back-to-homepage button.
const tabs = [
  { href: "/today", label: "Today", icon: "sun" },
  { href: "/meals", label: "MealOS", icon: "pan" },
  { href: "/people", label: "PeopleOS", icon: "users" },
  { href: "/todos", label: "To-dOS", icon: "checks" },
  { href: "/home-hub", label: "HomeOS", icon: "home" },
  { href: "/gifts", label: "GiftOS", icon: "gift" },
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
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 font-mono text-[10px] font-semibold tracking-tight ${
                active ? "text-brand" : "text-sub/80"
              }`}
            >
              <Icon name={t.icon} size={20} strokeWidth={active ? 2 : 1.7} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
