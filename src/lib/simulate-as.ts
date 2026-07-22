/** Per-tab admin simulation — carried in the URL (`?as=`), not a shared cookie. */
export const SIMULATE_QUERY_PARAM = "as";
export const SIMULATE_HEADER = "x-rp-simulate-email";
export const SIMULATE_STORAGE_KEY = "rp_simulate_email";

export function appendSimulateParam(
  href: string,
  email: string | null | undefined,
): string {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return href;
  const url = new URL(href, "https://rp.local");
  url.searchParams.set(SIMULATE_QUERY_PARAM, normalized);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function stripSimulateParam(href: string): string {
  const url = new URL(href, "https://rp.local");
  url.searchParams.delete(SIMULATE_QUERY_PARAM);
  const qs = url.searchParams.toString();
  return `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`;
}
