// Curated Slack-profile fields pulled from the flaron admin API and folded into
// AI clue generation. Only fields that help recognize or locate a real person at
// an event are allowed through — deliberately no online handles/links (GitHub,
// Website, Social), no internal data (Manager), no PII (Birthday, Start Date),
// and no jargon-prone fields (Title, Name Pronunciation, Favorite Channel(s)),
// which in practice are abused for channel plugs.
const ALLOWED_FIELDS = [
  'Location',
  'Fav Activities',
  'Fav Languages/Tools',
  'Fav Food(s)',
  'Fav Band/Artist(s)',
  'Fandoms',
] as const;

export type ProfileField = { label: string; value: string };

// Fetch a user's allow-listed profile fields. Fail-soft: any error or missing
// config yields [] so clue generation still runs on the self-description alone.
export async function fetchProfileFields(slackId: string): Promise<ProfileField[]> {
  const base = import.meta.env.FLARON_URL;
  const key = import.meta.env.FLARON_ADMIN_KEY;
  if (!base || !key) return [];

  try {
    const res = await fetch(`${base}/admin/userDetailed?id=${encodeURIComponent(slackId)}`, {
      headers: { 'X-Admin-Key': key },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const body = (await res.json()) as { data?: Record<string, unknown> };
    const data = body?.data;
    if (!data || typeof data !== 'object') return [];

    const fields: ProfileField[] = [];
    for (const label of ALLOWED_FIELDS) {
      // Allow-listed fields are plain strings; anything else (link objects,
      // arrays) is skipped rather than guessed at.
      const raw = data[label];
      if (typeof raw !== 'string') continue;
      const value = raw.trim();
      if (value) fields.push({ label, value });
    }
    return fields;
  } catch (error) {
    console.error('fetchProfileFields failed:', error);
    return [];
  }
}
