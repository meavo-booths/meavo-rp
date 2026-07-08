"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { DashboardPartCard, PartsViewType } from "@/lib/domain/dashboard-parts";
import type { ViewerContext } from "@/lib/viewer-context";

const TABS: { id: PartsViewType; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "ready", label: "Ready" },
  { id: "archive", label: "Shipped" },
  { id: "cancelled", label: "Cancelled" },
];

export function PartsDashboard({
  viewer,
}: {
  viewer: ViewerContext;
}) {
  const [view, setView] = useState<PartsViewType>("active");
  const [search, setSearch] = useState("");
  const [parts, setParts] = useState<DashboardPartCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ view });
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/dashboard/parts?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setParts(data.parts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [view, search]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancelRp(rpNum: string) {
    if (!confirm(`Cancel ${rpNum}?`)) return;
    const res = await fetch(`/api/rp/${encodeURIComponent(rpNum)}/cancel`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Failed to cancel");
      return;
    }
    void load();
  }

  const showReadyTab = Boolean(viewer.reviewerConfig);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">
            Viewing as <strong>{viewer.effectiveEmail}</strong>
            {viewer.reviewerConfig ? " (reviewer)" : ""}
          </p>
        </div>
        <Link
          href="/log"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New RP
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.filter((tab) => tab.id !== "ready" || showReadyTab).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={`rounded-full px-3 py-1 text-sm ${
              view === tab.id
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search RP, client, market…"
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
      />

      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {!loading && !error && parts.length === 0 ? (
        <p className="text-sm text-slate-500">No parts in this view.</p>
      ) : null}

      <div className="grid gap-3">
        {parts.map((part) => (
          <article
            key={part.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {part.rpNum}
                  {part.urgency === "urgent" ? (
                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      Urgent
                    </span>
                  ) : null}
                </h2>
                <p className="text-sm text-slate-600">
                  {part.itemType} · {part.market} · {part.status || "Active"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {part.canEditRp ? (
                  <Link
                    href={`/log?editRp=${encodeURIComponent(part.rpNum)}`}
                    className="rounded border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
                  >
                    Edit
                  </Link>
                ) : null}
                {view === "active" && part.userId === viewer.effectiveEmail ? (
                  <button
                    type="button"
                    onClick={() => void cancelRp(part.rpNum)}
                    className="rounded border border-red-200 px-3 py-1 text-sm text-red-700 hover:bg-red-50"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
            <dl className="mt-3 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Client</dt>
                <dd>{part.client || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Due</dt>
                <dd>{part.dueDate || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Model / Booth</dt>
                <dd>
                  {part.model || "—"} / {part.boothId || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Description</dt>
                <dd>{part.partDescription || part.itemType || "—"}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
