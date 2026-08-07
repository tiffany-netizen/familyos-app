export const AVATAR_COLORS = [
  "#26584A",
  "#2E7396",
  "#7C5CBF",
  "#B45309",
  "#5B7FA0",
  "#A0525B",
];

export function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function relationshipLabel(rel: string) {
  const map: Record<string, string> = {
    spouse: "Spouse",
    child: "Kid",
    parent: "Parent",
    friend: "Friend",
    pet: "Pet",
    other: "Person",
  };
  return map[rel] ?? rel;
}

export function daysSince(dateStr: string | null) {
  if (!dateStr) return null;
  return Math.round(
    (Date.now() - new Date(dateStr + "T00:00:00").getTime()) / 86400000
  );
}
