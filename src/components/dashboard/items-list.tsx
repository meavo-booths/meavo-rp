import type { ParsedRpLineItem } from "@/lib/domain/rp-line-items";

function itemDisplayText(item: ParsedRpLineItem): string {
  if (item.kind === "part") {
    const code = item.partRpCode ? `${item.partRpCode} — ` : "";
    return `${code}${item.partDescription ?? item.quantity ?? "Part"}`;
  }
  const panel = item.panelName ?? "Panel";
  const qty = item.quantity && item.quantity !== "1" ? ` (${item.quantity})` : "";
  return `${panel}${qty}`;
}

export function ItemsList({ items }: { items: ParsedRpLineItem[] }) {
  if (!items.length) {
    return <p className="text-sm text-slate-500">N/A</p>;
  }
  return (
    <ul className="list-inside list-disc space-y-0.5 text-sm text-slate-800">
      {items.map((item) => (
        <li key={item.lineIndex}>{itemDisplayText(item)}</li>
      ))}
    </ul>
  );
}
