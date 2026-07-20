import { normalizeEmail } from "@/lib/domain/authz";

/** GAS getStandardRegionalButtonDefsForUser_ — scope toggles for standard dashboard. */
export type StandardRegionalButtonDef = {
  scope: string;
  label: string;
};

const STANDARD_REGIONAL_BUTTON_DEFS: Record<string, StandardRegionalButtonDef[]> =
  {
    "hedi@meavo.com": [
      { scope: "fr_ch", label: "All FR / CH RPs" },
      { scope: "usa", label: "USA" },
      { scope: "iberia", label: "Italy/Spain/Portugal" },
      { scope: "de_balkans", label: "Germany/Balkans" },
      { scope: "czechia", label: "Czechia" },
    ],
    "carla@meavo.com": [{ scope: "uk", label: "All UK RPs" }],
    "eftychia@meavo.com": [{ scope: "uk", label: "All UK RPs" }],
    "dimitar@meavo.com": [
      { scope: "de_balkans", label: "All Germany / Balkans RPs" },
      { scope: "france", label: "France RPs" },
    ],
    "rosalia@meavo.com": [{ scope: "usa", label: "All USA RPs" }],
    "giulia@meavo.com": [
      { scope: "iberia", label: "All Italy / Spain / Portugal RPs" },
    ],
    "vojtech@meavo.com": [{ scope: "all_markets", label: "View All Markets" }],
  };

export function getStandardRegionalButtonDefs(
  email: string | null | undefined,
): StandardRegionalButtonDef[] {
  return STANDARD_REGIONAL_BUTTON_DEFS[normalizeEmail(email)] ?? [];
}

export function getAllowedRegionalScopes(
  email: string | null | undefined,
): string[] {
  return getStandardRegionalButtonDefs(email).map((def) => def.scope);
}

/** Active scopes from `?scope=uk|fr_ch` query (empty = own RPs only). */
export function parseActiveRegionalScopes(
  scopeParam: string | null | undefined,
): string[] {
  if (!scopeParam?.trim()) return [];
  return scopeParam
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** GAS getValidatedRegionalScopeArg_ — drop scopes the user is not allowed to use. */
export function normalizeRegionalScopeRequest(
  email: string | null | undefined,
  scopeParam: string | null | undefined,
): string {
  const allowed = new Set(getAllowedRegionalScopes(email));
  if (!allowed.size) return "";
  const parts = parseActiveRegionalScopes(scopeParam).filter((s) => allowed.has(s));
  return parts.join("|");
}

export function toggleRegionalScope(
  active: string[],
  scopeId: string,
): string[] {
  const next = new Set(active);
  if (next.has(scopeId)) next.delete(scopeId);
  else next.add(scopeId);
  return [...next];
}

export function formatRegionalScopeParam(scopes: string[]): string | undefined {
  const joined = scopes.filter(Boolean).join("|");
  return joined || undefined;
}
