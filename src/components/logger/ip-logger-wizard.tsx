"use client";

import { useRef, useState } from "react";

import { createIpEntryAction } from "@/app/actions/rp-mutations";
import { Button } from "@/components/ui";
import { useActionLock } from "@/hooks/use-action-lock";
import type { IpLoggerFormInput } from "@/lib/domain/ip-create";
import { getPanelsForModel } from "@/lib/reference-data/panel-options";
import type { PanelOptionsPayload } from "@/lib/reference-data/sheets";

const REASONS = [
  "Stock Replacement",
  "Panel with Foil",
  "Reversed Hinges",
  "Other",
];

const MODELS = [
  "Soho",
  "Workstation",
  "Camden 2",
  "Camden 4",
  "Haven One",
  "Haven Focus",
  "Haven Two",
  "Haven Four",
];

const COLOR_OPTIONS = [
  "White Stock",
  "Black Stock",
  "Natural Oak",
  "Stone Green",
  "Antique Rose",
  "Sandy Yellow",
  "Indigo Blue",
  "Custom RAL",
  "Other",
];

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-100";

export function IpLoggerWizard({
  panelOptions,
  embedded,
  onClose,
  onSuccess,
}: {
  panelOptions: PanelOptionsPayload;
  embedded?: boolean;
  onClose?: () => void;
  onSuccess?: (ipNums: string[]) => void;
}) {
  const submitKeyRef = useRef<string>("");
  if (!submitKeyRef.current) {
    submitKeyRef.current =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `ip-${Date.now()}`;
  }
  const { busy, runLocked } = useActionLock();
  const [error, setError] = useState<string | null>(null);
  const [successNums, setSuccessNums] = useState<string[] | null>(null);
  const [colorSelect, setColorSelect] = useState("");
  const [customColor, setCustomColor] = useState("");
  const [form, setForm] = useState<IpLoggerFormInput>({
    urgency: "standard",
    reason: "Stock Replacement",
    model: "",
    batch: "",
    color: "",
    panels: [{ panel: "", clarification: "" }],
  });

  const panelList = getPanelsForModel(form.model, panelOptions);
  const needsCustomColor =
    colorSelect === "Custom RAL" || colorSelect === "Other";

  function applyColor(select: string, custom: string) {
    setColorSelect(select);
    setCustomColor(custom);
    let color = select;
    if (select === "Custom RAL") {
      color = custom.trim() ? `RAL ${custom.trim()}` : "";
    } else if (select === "Other") {
      color = custom.trim();
    }
    setForm((prev) => ({ ...prev, color }));
  }

  async function submit() {
    try {
      const result = await runLocked(() =>
        createIpEntryAction(form, submitKeyRef.current),
      );
      if (!result) return;
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccessNums(result.ipNums ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  function resetForAnother() {
    submitKeyRef.current =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `ip-${Date.now()}`;
    setForm({
      urgency: "standard",
      reason: "Stock Replacement",
      model: "",
      batch: "",
      color: "",
      panels: [{ panel: "", clarification: "" }],
    });
    setColorSelect("");
    setCustomColor("");
    setError(null);
    setSuccessNums(null);
  }

  if (successNums) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700"
          aria-hidden
        >
          ✓
        </div>
        <h3 className="text-xl font-extrabold text-slate-900">
          Успешно записано
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          IP:{" "}
          <strong className="text-slate-900">
            {successNums.length ? successNums.join(", ") : "—"}
          </strong>
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={resetForAnother}>Нов запис</Button>
          <Button
            variant="secondary"
            onClick={() => {
              onSuccess?.(successNums);
              if (!embedded) onClose?.();
            }}
          >
            Към таблото
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-4">
      {busy ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-[#FAF9F7]/85">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          <p className="mt-3 text-sm font-semibold text-slate-800">Записване…</p>
        </div>
      ) : null}

      {!embedded ? (
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
            Нов IP запис
          </h1>
          <p className="text-sm font-medium text-slate-500">
            Internal production — Аксаково
          </p>
        </div>
      ) : null}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <p className="text-sm font-semibold text-slate-800">Спешност</p>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(
              [
                ["standard", "Стандартна"],
                ["urgent", "Спешна"],
              ] as const
            ).map(([value, label]) => {
              const active = form.urgency === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, urgency: value })}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-semibold ${
                    active
                      ? value === "urgent"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-brand-600 bg-brand-50 text-brand-800"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block text-sm font-semibold text-slate-800">
          Причина
          <select
            className={fieldClass}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        {form.reason === "Other" ? (
          <label className="block text-sm font-semibold text-slate-800">
            Описание на причината
            <input
              className={fieldClass}
              value={form.reasonOther ?? ""}
              onChange={(e) =>
                setForm({ ...form, reasonOther: e.target.value })
              }
            />
          </label>
        ) : null}

        <label className="block text-sm font-semibold text-slate-800">
          Модел на кабина
          <select
            className={fieldClass}
            value={form.model}
            onChange={(e) =>
              setForm({ ...form, model: e.target.value, color: "" })
            }
          >
            <option value="">—</option>
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          Партида
          <input
            className={fieldClass}
            value={form.batch}
            onChange={(e) => setForm({ ...form, batch: e.target.value })}
          />
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          Цвят
          <select
            className={fieldClass}
            value={colorSelect}
            onChange={(e) => applyColor(e.target.value, customColor)}
          >
            <option value="">Select…</option>
            {COLOR_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {needsCustomColor ? (
          <label className="block text-sm font-semibold text-slate-800">
            {colorSelect === "Custom RAL" ? "Enter RAL / Color" : "Other color"}
            <input
              className={fieldClass}
              value={customColor}
              onChange={(e) => applyColor(colorSelect, e.target.value)}
            />
          </label>
        ) : null}

        {form.panels.map((panel, i) => (
          <div
            key={i}
            className="space-y-3 rounded-lg border border-[#F2F0EB] bg-[#FAF9F7] p-3.5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-700">
                Панел {i + 1}
              </span>
              {form.panels.length > 1 ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-red-600 hover:underline"
                  onClick={() =>
                    setForm({
                      ...form,
                      panels: form.panels.filter((_, idx) => idx !== i),
                    })
                  }
                >
                  Премахни
                </button>
              ) : null}
            </div>
            <label className="block text-sm font-semibold text-slate-800">
              Панел
              <select
                className={fieldClass}
                value={panel.panel}
                onChange={(e) => {
                  const panels = [...form.panels];
                  panels[i] = { ...panels[i], panel: e.target.value };
                  setForm({ ...form, panels });
                }}
              >
                <option value="">—</option>
                {panelList.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Бележки
              <textarea
                rows={2}
                className={fieldClass}
                value={panel.clarification ?? ""}
                onChange={(e) => {
                  const panels = [...form.panels];
                  panels[i] = { ...panels[i], clarification: e.target.value };
                  setForm({ ...form, panels });
                }}
              />
            </label>
          </div>
        ))}

        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setForm({
              ...form,
              panels: [...form.panels, { panel: "", clarification: "" }],
            })
          }
        >
          + Добави още един панел
        </Button>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" className="w-full py-3 font-bold" disabled={busy}>
          {busy ? "Запазване…" : "Запиши IP запис(и)"}
        </Button>
      </form>
    </div>
  );
}
