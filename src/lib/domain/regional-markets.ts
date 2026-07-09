/** Regional scope matching — ported from GAS matchesRegionalMarket_. */

export function matchesRegionalScope(scope: string, market: string | null): boolean {
  const s = scope.trim().toLowerCase();
  const m = (market ?? "").trim().toLowerCase();
  if (s === "all_markets") return true;
  if (!m) return false;
  if (s === "fr_ch") {
    return ["france", "swiss", "switzerland", "ch"].includes(m);
  }
  if (s === "france") return m === "france";
  if (s === "uk") {
    return ["uk", "united kingdom", "great britain", "gb"].includes(m);
  }
  if (s === "usa") {
    return ["usa", "united states", "us", "united states of america"].includes(m);
  }
  if (s === "de_balkans") {
    return [
      "germany", "deutschland", "bulgaria", "croatia", "serbia", "greece",
      "macedonia", "north macedonia", "romania", "slovenia", "albania",
    ].includes(m);
  }
  if (s === "iberia") {
    return ["italy", "spain", "portugal"].includes(m);
  }
  if (s === "czechia") {
    return ["czechia", "czech republic", "czech", "cz"].includes(m);
  }
  return m === s || m.startsWith(`${s}-`);
}
