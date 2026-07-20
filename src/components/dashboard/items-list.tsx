import type { ParsedRpLineItem } from "@/lib/domain/rp-line-items";

function itemDisplayText(item: ParsedRpLineItem): string {
  if (item.kind === "part") {
    const qty = item.quantity ? `${item.quantity}x ` : "";
    const desc = item.partDescription ?? item.partRpCode ?? "Part";
    const code = item.partRpCode ? ` [${item.partRpCode}]` : "";
    return `${qty}${desc}${code}`;
  }
  const qty = item.quantity ? `${item.quantity}x ` : "";
  const panel = item.panelName ?? "Panel";
  return `${qty}${panel}`;
}

export function ItemsList({ items }: { items: ParsedRpLineItem[] }) {
  if (!items.length) {
    return <p className="mt-2 text-base font-semibold text-slate-800">N/A</p>;
  }
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item) => (
        <li
          key={item.lineIndex}
          className="border-l-[3px] border-brand-600 pl-2.5 text-[0.98rem] leading-snug text-slate-900"
        >
          &bull; {itemDisplayText(item)}
        </li>
      ))}
    </ul>
  );
}
