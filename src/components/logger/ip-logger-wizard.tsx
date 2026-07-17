"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { createIpEntryAction } from "@/app/actions/rp-mutations";
import { Button, Card, Input, Textarea } from "@/components/ui";
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

export function IpLoggerWizard({
  panelOptions,
}: {
  panelOptions: PanelOptionsPayload;
}) {
  const router = useRouter();
  const submitKeyRef = useRef<string>("");
  if (!submitKeyRef.current) {
    submitKeyRef.current =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `ip-${Date.now()}`;
  }
  const { busy, runLocked } = useActionLock();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<IpLoggerFormInput>({
    urgency: "standard",
    reason: "Stock Replacement",
    model: "",
    batch: "",
    color: "",
    panels: [{ panel: "", clarification: "" }],
  });

  const panelList = getPanelsForModel(form.model, panelOptions);

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
      router.push("/dashboard/nikolay");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold sm:text-2xl">IP Logger — Аксаково</h1>
      <Card className="space-y-4">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Спешност
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form.urgency}
              onChange={(e) => setForm({ ...form, urgency: e.target.value })}
            >
              <option value="standard">Standard</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label className="text-sm">
            Причина
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
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
            <Input
              label="Друго (опиши)"
              value={form.reasonOther ?? ""}
              onChange={(e) =>
                setForm({ ...form, reasonOther: e.target.value })
              }
            />
          ) : null}
          <label className="text-sm">
            Модел
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
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
          <Input
            label="Партида"
            value={form.batch}
            onChange={(e) => setForm({ ...form, batch: e.target.value })}
          />
          <Input
            label="Цвят"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
          />
        </div>
        {form.panels.map((panel, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              Панел
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
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
            <Textarea
              label="Уточнение"
              rows={2}
              value={panel.clarification ?? ""}
              onChange={(e) => {
                const panels = [...form.panels];
                panels[i] = { ...panels[i], clarification: e.target.value };
                setForm({ ...form, panels });
              }}
            />
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
          + Панел
        </Button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Запазване…" : "Запази IP"}
        </Button>
        </form>
      </Card>
    </div>
  );
}
