"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Card, Input } from "@/components/ui";
import type { NeonSheetPage } from "@/lib/domain/admin-neon-sheet";

export function AdminNeonSheetTable({ data }: { data: NeonSheetPage }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(data.search);

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  function navigate(next: {
    tab?: string;
    q?: string;
    page?: number;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.tab) params.set("tab", next.tab);
    if (next.q !== undefined) {
      if (next.q) params.set("q", next.q);
      else params.delete("q");
    }
    if (next.page !== undefined) {
      if (next.page <= 1) params.delete("page");
      else params.set("page", String(next.page));
    }
    startTransition(() => {
      router.push(`/admin/data?${params.toString()}`);
    });
  }

  return (
    <Card className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Neon data (sheet view)</h1>
        <p className="mt-1 text-sm text-slate-600">
          Read-only view of what the webapp uses in Neon, laid out like{" "}
          <strong>Rep.Parts26</strong> / <strong>Internal Production</strong> so
          you can compare with the Google Sheet.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            disabled={pending}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              data.tab === "rp"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:bg-white/70"
            }`}
            onClick={() => navigate({ tab: "rp", page: 1 })}
          >
            Rep.Parts26
          </button>
          <button
            type="button"
            disabled={pending}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              data.tab === "ip"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:bg-white/70"
            }`}
            onClick={() => navigate({ tab: "ip", page: 1 })}
          >
            Internal Production
          </button>
        </div>

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ q: search.trim(), page: 1 });
          }}
        >
          <div className="min-w-[220px]">
            <Input
              label="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="RP-252, client, market…"
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            className="px-3 py-2 text-sm"
            disabled={pending}
          >
            Search
          </Button>
        </form>

        <p className="ml-auto text-sm text-slate-500">
          {data.total.toLocaleString()} rows
          {data.search ? ` matching “${data.search}”` : ""} · page {data.page}/
          {totalPages}
        </p>
      </div>

      <div className="overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-max border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100">
            <tr>
              {data.columns.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap border-b border-slate-200 px-2 py-2 font-semibold text-slate-700"
                  title={col.key}
                >
                  <span className="text-slate-400">{col.letter}</span> {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={data.columns.length}
                  className="px-3 py-6 text-center text-slate-500"
                >
                  No rows.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-brand-50/40"
                >
                  {row.cells.map((cell, idx) => (
                    <td
                      key={`${row.id}-${idx}`}
                      className="max-w-[220px] px-2 py-1.5 align-top text-slate-800"
                      title={cell}
                    >
                      {cell ? (
                        <span className="line-clamp-3 whitespace-pre-wrap break-words">
                          {cell}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          className="px-3 py-1.5 text-sm"
          disabled={pending || data.page <= 1}
          onClick={() => navigate({ page: data.page - 1 })}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          className="px-3 py-1.5 text-sm"
          disabled={pending || data.page >= totalPages}
          onClick={() => navigate({ page: data.page + 1 })}
        >
          Next
        </Button>
      </div>
    </Card>
  );
}
