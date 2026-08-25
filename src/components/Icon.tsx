// Line icon set. Replaces emoji across the app: stroke icons read as a
// tool, emoji read as a toy. All 24x24, stroke currentColor.

const PATHS: Record<string, React.ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M19.1 4.9l-2.2 2.2M7.1 16.9l-2.2 2.2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 5.6M18.6 15.4c1.5.8 2.5 2.3 2.9 4.6" />
    </>
  ),
  checks: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </>
  ),
  home: (
    <>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5.5 9v11h13V9" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="8" width="17" height="4" />
      <path d="M5 12v8.5h14V12M12 8v12.5" />
      <path d="M12 8s-4.5.3-5.5-1.6C5.6 4.7 7.5 3 9 3.9c1.6 1 3 4.1 3 4.1zm0 0s4.5.3 5.5-1.6C18.4 4.7 16.5 3 15 3.9c-1.6 1-3 4.1-3 4.1z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="1.5" />
      <path d="M3.5 9.5h17M8 2.8V6M16 2.8V6" />
    </>
  ),
  phone: (
    <path d="M5.5 3.5h4l1.5 4.5-2.2 1.6a12.5 12.5 0 0 0 5.6 5.6l1.6-2.2 4.5 1.5v4c0 .8-.7 1.6-1.6 1.5C10.6 19.5 4.5 13.4 4 5.1c0-.9.7-1.6 1.5-1.6z" />
  ),
  wrench: (
    <path d="M14.5 3.2a5.4 5.4 0 0 0-5.9 7.6L3.2 16.2a2.1 2.1 0 0 0 3 3l5.4-5.4a5.4 5.4 0 0 0 7.6-5.9l-3.3 3.3-3.1-.8-.8-3.1z" />
  ),
  heart: (
    <path d="M12 20.5S4 15 4 9.5C4 6.5 6.3 4.5 8.8 4.5c1.4 0 2.6.7 3.2 1.7.6-1 1.8-1.7 3.2-1.7 2.5 0 4.8 2 4.8 5 0 5.5-8 11-8 11z" />
  ),
  briefcase: (
    <>
      <rect x="3.5" y="7.5" width="17" height="12.5" rx="1.5" />
      <path d="M9 7.5V5.2c0-.7.5-1.2 1.2-1.2h3.6c.7 0 1.2.5 1.2 1.2v2.3M3.5 12.5h17" />
    </>
  ),
  luggage: (
    <>
      <rect x="6" y="7" width="12" height="13" rx="1.5" />
      <path d="M9.5 7V4.5c0-.6.4-1 1-1h3c.6 0 1 .4 1 1V7M9.5 11v5M14.5 11v5" />
    </>
  ),
  message: (
    <path d="M4 4.5h16v11.5H9l-5 4z" />
  ),
  pan: (
    <>
      <circle cx="10" cy="12" r="6.5" />
      <path d="M16.5 12h5" />
    </>
  ),
  backpack: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0v11H6z" />
      <path d="M9.5 4.5a2.5 2.5 0 0 1 5 0M6 14h12M9.5 14v3.5h5V14" />
    </>
  ),
  camera: (
    <>
      <path d="M3.5 7.5h4l1.5-2.5h6l1.5 2.5h4v12h-17z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  spark: (
    <path d="M12 2.5l2 6.5 6.5 2-6.5 2-2 6.5-2-6.5-6.5-2 6.5-2z" />
  ),
  clipboard: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="1.5" />
      <path d="M9 4.5a3 3 0 0 1 6 0M8.5 10.5h7M8.5 14h7M8.5 17.5h4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16v-6a6 6 0 0 1 12 0v6l1.5 2.5h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
};

export default function Icon({
  name,
  size = 20,
  strokeWidth = 1.7,
  className = "",
}: {
  name: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name] ?? PATHS.clipboard}
    </svg>
  );
}

// Pick a line icon for a brief card from its stable key and role.
export function briefIcon(key: string | undefined, role: string): string {
  const k = key ?? "";
  if (k.startsWith("call:")) return "phone";
  if (k.startsWith("birthday:") || k.startsWith("date:")) return "calendar";
  if (k.startsWith("home:")) return "wrench";
  if (k.startsWith("trip:")) return "luggage";
  if (k.startsWith("sport:") || k.startsWith("activity:")) return "calendar";
  if (k.startsWith("school-run")) return "backpack";
  if (k.startsWith("dinner")) return "pan";
  if (k === "sweet-text") return "message";
  if (k === "gift-radar") return "gift";
  switch (role) {
    case "husband":
      return "heart";
    case "dad":
      return "backpack";
    case "son":
    case "friend":
      return "phone";
    case "home":
      return "wrench";
    default:
      return "clipboard";
  }
}
