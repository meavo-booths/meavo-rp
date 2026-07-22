"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  bulkLinkPartsByEqualCodeAction,
  deductMaterialsAction,
  deletePanelMapAction,
  deletePartMapAction,
  seedExactMatchPanelMapsAction,
  upsertPanelMapAction,
  upsertPartMapAction,
} from "@/app/actions/catalogue-mrp";
import { Button, Card, Input } from "@/components/ui";
import type {
  CataloguePanelRow,
  CataloguePartRow,
  MrpElementOption,
  MrpMaterialOption,
  PanelMapRow,
  PartMapRow,
  ReadyUndeductedRow,
} from "@/lib/domain/catalogue-mrp";

export type CatalogueTab = "parts" | "panels" | "mappings" | "ready";

type Props = {
  tab: CatalogueTab;
  parts: CataloguePartRow[];
  panels: CataloguePanelRow[];
  partMaps: PartMapRow[];
  panelMaps: PanelMapRow[];
  materials: MrpMaterialOption[];
  elements: MrpElementOption[];
  readyLines: ReadyUndeductedRow[];
  canDeduct: boolean;
};

function statusBadge(mapped: boolean) {
  return mapped ? (
    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
      Linked
    </span>
  ) : (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
      Unmapped
    </span>
  );
}

export function CatalogueClient(props: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [partCode, setPartCode] = useState("");
  const [partMaterialId, setPartMaterialId] = useState("");
  const [panelModel, setPanelModel] = useState("");
  const [panelName, setPanelName] = useState("");
  const [panelElementId, setPanelElementId] = useState("");

  const filteredParts = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return props.parts;
    return props.parts.filter(
      (p) =>
        p.code.includes(needle) ||
        p.description.toLowerCase().includes(needle) ||
        p.category.toLowerCase().includes(needle) ||
        (p.mrpMaterialCode ?? "").toLowerCase().includes(needle),
    );
  }, [props.parts, q]);

  const filteredPanels = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return props.panels;
    return props.panels.filter(
      (p) =>
        p.boothModelName.toLowerCase().includes(needle) ||
        p.rpPanelName.toLowerCase().includes(needle) ||
        (p.mrpSimpleName ?? "").toLowerCase().includes(needle),
    );
  }, [props.panels, q]);

  function setTab(next: CatalogueTab) {
    router.push(`/admin/catalogue?tab=${next}`);
  }

  function run(
    label: string,
    action: () => Promise<{ error?: string; linked?: number; skipped?: number; deduct?: { posted: number; skipped: number; errors: number } }>,
  ) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.deduct) {
        setMessage(
          `${label}: posted ${result.deduct.posted}, skipped ${result.deduct.skipped}, errors ${result.deduct.errors}`,
        );
      } else if (result.linked != null) {
        setMessage(
          `${label}: linked ${result.linked}${result.skipped != null ? `, skipped ${result.skipped}` : ""}`,
        );
      } else {
        setMessage(`${label}: done`);
      }
      router.refresh();
    });
  }

  const tabs: { id: CatalogueTab; label: string }[] = [
    { id: "parts", label: `Parts (${props.parts.length})` },
    { id: "panels", label: `Panels (${props.panels.length})` },
    { id: "mappings", label: "Mappings" },
    { id: "ready", label: `Ready (${props.readyLines.length})` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              props.tab === t.id
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(props.tab === "parts" || props.tab === "panels") && (
        <Input
          label="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Code, name, model…"
        />
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-brand-700">{message}</p> : null}

      {props.tab === "parts" ? (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">MRP</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.map((p) => (
                <tr key={p.code} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-mono">{p.code}</td>
                  <td className="px-3 py-2">{p.description}</td>
                  <td className="px-3 py-2 text-slate-500">{p.category}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {p.mrpMaterialCode
                      ? `${p.mrpMaterialCode} — ${p.mrpMaterialName ?? ""}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">{statusBadge(p.mapped)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {props.tab === "panels" ? (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">RP panel</th>
                <th className="px-3 py-2">MRP element</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPanels.map((p) => (
                <tr
                  key={`${p.boothModelName}:${p.rpPanelName}`}
                  className="border-b border-slate-100"
                >
                  <td className="px-3 py-2">{p.boothModelName}</td>
                  <td className="px-3 py-2">{p.rpPanelName}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {p.mrpSimpleName ?? "—"}
                  </td>
                  <td className="px-3 py-2">{statusBadge(p.mapped)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {props.tab === "mappings" ? (
        <div className="space-y-4">
          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Part → MRP material
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  run("Link equal codes", () =>
                    bulkLinkPartsByEqualCodeAction(),
                  )
                }
              >
                Link by equal code
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="RP code"
                value={partCode}
                onChange={(e) => setPartCode(e.target.value)}
                placeholder="1234"
              />
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  MRP material
                </span>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={partMaterialId}
                  onChange={(e) => setPartMaterialId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {props.materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {(m.code ?? "—") + " — " + m.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <Button
                  type="button"
                  disabled={pending || !partCode || !partMaterialId}
                  onClick={() =>
                    run("Save part map", () =>
                      upsertPartMapAction({
                        partRpCode: partCode,
                        mrpMaterialId: partMaterialId,
                      }),
                    )
                  }
                >
                  Save map
                </Button>
              </div>
            </div>
            <ul className="divide-y divide-slate-100 text-sm">
              {props.partMaps.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span>
                    <span className="font-mono">{m.partRpCode}</span>
                    {" → "}
                    {(m.mrpMaterialCode ?? "—") + " — " + m.mrpMaterialName}
                  </span>
                  <Button
                    type="button"
                    variant="danger"
                    className="px-2 py-1 text-xs"
                    disabled={pending}
                    onClick={() =>
                      run("Delete part map", () => deletePartMapAction(m.id))
                    }
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Panel → MRP recipe element
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  run("Seed exact panel matches", () =>
                    seedExactMatchPanelMapsAction(),
                  )
                }
              >
                Seed exact name matches
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Booth model"
                value={panelModel}
                onChange={(e) => setPanelModel(e.target.value)}
                placeholder="Soho"
              />
              <Input
                label="RP panel name"
                value={panelName}
                onChange={(e) => setPanelName(e.target.value)}
              />
              <label className="block text-sm sm:col-span-2 lg:col-span-1">
                <span className="mb-1 block font-medium text-slate-700">
                  MRP element
                </span>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={panelElementId}
                  onChange={(e) => setPanelElementId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {props.elements.map((el) => (
                    <option key={el.id} value={el.id}>
                      {el.boothModelName} / {el.simpleName}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <Button
                  type="button"
                  disabled={
                    pending || !panelModel || !panelName || !panelElementId
                  }
                  onClick={() =>
                    run("Save panel map", () =>
                      upsertPanelMapAction({
                        boothModelName: panelModel,
                        rpPanelName: panelName,
                        boothElementId: panelElementId,
                      }),
                    )
                  }
                >
                  Save map
                </Button>
              </div>
            </div>
            <ul className="divide-y divide-slate-100 text-sm">
              {props.panelMaps.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span>
                    {m.boothModelName} / {m.rpPanelName}
                    {" → "}
                    {m.mrpBoothModelName} / {m.mrpSimpleName}
                  </span>
                  <Button
                    type="button"
                    variant="danger"
                    className="px-2 py-1 text-xs"
                    disabled={pending}
                    onClick={() =>
                      run("Delete panel map", () => deletePanelMapAction(m.id))
                    }
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      {props.tab === "ready" ? (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              Ready RPs with materials not yet deducted in MRP.
            </p>
            {props.canDeduct ? (
              <Button
                type="button"
                disabled={pending || selected.size === 0}
                onClick={() =>
                  run("Deduct materials", () =>
                    deductMaterialsAction({
                      rpLineItemIds: [...selected],
                    }),
                  )
                }
              >
                Deduct selected ({selected.size})
              </Button>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={
                        props.readyLines.length > 0 &&
                        selected.size === props.readyLines.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelected(
                            new Set(props.readyLines.map((l) => l.lineItemId)),
                          );
                        } else {
                          setSelected(new Set());
                        }
                      }}
                    />
                  </th>
                  <th className="px-3 py-2">RP</th>
                  <th className="px-3 py-2">Kind</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Factory</th>
                  <th className="px-3 py-2">Last error</th>
                </tr>
              </thead>
              <tbody>
                {props.readyLines.map((l) => (
                  <tr key={l.lineItemId} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(l.lineItemId)}
                        onChange={(e) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(l.lineItemId);
                            else next.delete(l.lineItemId);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">{l.rpNum}</td>
                    <td className="px-3 py-2">{l.kind}</td>
                    <td className="px-3 py-2">
                      {l.kind === "part"
                        ? l.partRpCode ?? "—"
                        : `${l.model ?? ""} / ${l.panelName ?? ""}`}
                    </td>
                    <td className="px-3 py-2">{l.quantity ?? "1"}</td>
                    <td className="px-3 py-2">{l.reviewGroup ?? "—"}</td>
                    <td className="px-3 py-2 text-red-600">
                      {l.materialsDeductionError ?? ""}
                    </td>
                  </tr>
                ))}
                {props.readyLines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-6 text-center text-slate-500"
                    >
                      No Ready lines pending deduction.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
