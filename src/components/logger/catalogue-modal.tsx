"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui";
import type { CatalogueCategory } from "@/lib/reference-data/catalogue";
import { getCatalogueDriveThumbnailUrl } from "@/lib/reference-data/catalogue-images";

function isStandardPartnerYes(value: string | undefined): boolean {
  const sp = (value ?? "").trim().toLowerCase();
  return sp === "yes" || sp === "y" || sp === "true" || sp === "1";
}

export function CatalogueModal({
  categories,
  open,
  onClose,
  onSelect,
}: {
  categories: CatalogueCategory[];
  open: boolean;
  onClose: () => void;
  onSelect: (code: string, description: string, standardPartner: boolean) => void;
}) {
  const [activeCategory, setActiveCategory] = useState(
    categories[0]?.category ?? "",
  );
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cat =
      categories.find((c) => c.category === activeCategory) ?? categories[0];
    if (!cat) return [];
    if (!q) return cat.rows;
    return cat.rows.filter(
      (row) =>
        (row.description ?? "").toLowerCase().includes(q) ||
        (row.code ?? "").toLowerCase().includes(q),
    );
  }, [categories, activeCategory, search]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
          <div className="flex-1">
            <h2 className="font-semibold">Spare parts catalogue</h2>
            <p className="text-xs text-slate-500">Tap an item to select</p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          />
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 border-b border-slate-100 px-4 py-2">
          {categories.map((cat) => (
            <button
              key={cat.category}
              type="button"
              onClick={() => setActiveCategory(cat.category)}
              className={`rounded-md px-2 py-1 text-xs ${
                activeCategory === cat.category
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {cat.category}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500">No items match.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {filtered.map((row, i) => (
                <button
                  key={`${row.code}-${i}`}
                  type="button"
                  onClick={() => {
                    onSelect(
                      row.code ?? "",
                      row.description ?? "",
                      isStandardPartnerYes(row.standardPartner),
                    );
                    onClose();
                  }}
                  className="flex gap-3 rounded-lg border border-slate-200 p-3 text-left hover:border-brand-500"
                >
                  {row.photoUrl || row.imageFileId ? (
                    <img
                      src={
                        row.photoUrl ??
                        getCatalogueDriveThumbnailUrl(row.imageFileId ?? "") ??
                        ""
                      }
                      alt=""
                      className="h-12 w-12 shrink-0 rounded object-cover bg-slate-100"
                    />
                  ) : null}
                  <div>
                  <div className="text-sm font-medium">{row.description}</div>
                  {row.code ? (
                    <div className="text-xs text-slate-500">
                      RP {row.code}
                      {row.booth ? ` · ${row.booth}` : ""}
                    </div>
                  ) : null}
                  {isStandardPartnerYes(row.standardPartner) ? (
                    <div className="text-xs font-medium text-amber-700">
                      Standard partner item
                    </div>
                  ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
