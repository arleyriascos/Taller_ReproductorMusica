export const AUDIUS_API = "https://api.audius.co/v1";
export const AUDIUS_SITE = "https://audius.co";
export const AUDIUS_APP_NAME = "Musongs";
export const AUDIUS_GENRES: readonly string[] = ["Electronic", "Hip-Hop/Rap", "Rock", "Pop", "Lo-Fi", "Latin"];
export const AUDIUS_RESULT_LIMIT = 30;

export function audiusFingerprint(trackId: string): string {
  return `audius:${trackId}`;
}

export function audiusStreamUrl(trackId: string): string {
  return `${AUDIUS_API}/tracks/${encodeURIComponent(trackId)}/stream?app_name=${AUDIUS_APP_NAME}`;
}

export function audiusListUrl(path: string, params: Readonly<Record<string, string>>): string {
  const query = new URLSearchParams({ ...params, limit: String(AUDIUS_RESULT_LIMIT), app_name: AUDIUS_APP_NAME });
  return `${AUDIUS_API}${path}?${query.toString()}`;
}
