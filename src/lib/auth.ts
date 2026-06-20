import type { AstroCookies } from 'astro';

export type Session = {
  slack_id: string;
  display_name: string;
  avatar_url: string | null;
};

export function getSession(cookies: AstroCookies): Session | null {
  const raw = cookies.get('session')?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function isAdmin(slack_id: string): boolean {
  return (import.meta.env.ADMIN_USERS ?? '')
    .split(/[\s,;]+/)
    .map((s: string) => s.trim())
    .map((s: string) => s.replace(/^["']|["']$/g, ''))
    .filter(Boolean)
    .some((adminId: string) => adminId.toUpperCase() === slack_id.toUpperCase());
}
