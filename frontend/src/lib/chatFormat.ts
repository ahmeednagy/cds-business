import type { ChatUser } from "../types";

export function displayName(u?: ChatUser | null): string {
  if (!u) return "";
  const n = [u.first_name, u.last_name].filter(Boolean).join(" ");
  return n || u.email;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
