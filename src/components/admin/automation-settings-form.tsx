"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  forceAllAutomationsToGasAction,
  updateAutomationSettingsAction,
} from "@/app/actions/automation-settings";
import { Button, Card } from "@/components/ui";
import type {
  AutomationSettingRow,
  AutomationSettingsMap,
  AutomationSource,
} from "@/lib/domain/automation-settings";

export function AutomationSettingsForm({
  rows,
  settings,
  forceOff,
}: {
  rows: AutomationSettingRow[];
  settings: AutomationSettingsMap;
  forceOff: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const anyWebapp = rows.some((row) => settings[row.key] === "webapp");

  async function setSource(key: AutomationSettingRow["key"], source: AutomationSource) {
    setError(null);
    const result = await updateAutomationSettingsAction(key, source);
    if (result.error) {
      setError(result.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function setAllGas() {
    setError(null);
    const result = await forceAllAutomationsToGasAction();
    if (result.error) {
      setError(result.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <Card className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Automation source</h1>
        <p className="mt-1 text-sm text-slate-600">
          Choose whether each function runs from legacy GAS or this webapp. Keep
          everything on <strong>GAS</strong> until cutover so Slack is not
          duplicated.
        </p>
        {forceOff ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
            <strong>RP_NOTIFICATIONS_FORCE_OFF=true</strong> — all webapp
            automations are disabled regardless of these toggles.
          </p>
        ) : null}
        {anyWebapp && !forceOff ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
            One or more rows are on Webapp — Slack/crons may duplicate GAS.
            Prefer “Set all to GAS” while testing.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          className="px-3 py-1.5 text-sm"
          disabled={pending || forceOff || !anyWebapp}
          onClick={() => void setAllGas()}
        >
          Set all to GAS
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4 font-medium">Function</th>
              <th className="py-2 pr-4 font-medium">GAS script</th>
              <th className="py-2 pr-4 font-medium">Source</th>
              <th className="py-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const source = settings[row.key];
              return (
                <tr key={row.key} className="border-b border-slate-100 align-top">
                  <td className="py-3 pr-4">
                    <div className="font-medium text-slate-900">{row.label}</div>
                    <div className="text-xs text-slate-500">{row.description}</div>
                    {row.cronPath ? (
                      <div className="mt-1 font-mono text-xs text-slate-400">
                        {row.cronPath}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-600">
                    <div>{row.gasScript}</div>
                    <div className="text-slate-400">{row.gasTriggerHint}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex gap-2">
                      <Button
                        variant={source === "gas" ? "primary" : "secondary"}
                        className="px-3 py-1 text-xs"
                        disabled={pending || forceOff}
                        onClick={() => void setSource(row.key, "gas")}
                      >
                        GAS
                      </Button>
                      <Button
                        variant={source === "webapp" ? "primary" : "secondary"}
                        className="px-3 py-1 text-xs"
                        disabled={pending || forceOff}
                        onClick={() => void setSource(row.key, "webapp")}
                      >
                        Webapp
                      </Button>
                    </div>
                  </td>
                  <td className="py-3 text-xs text-slate-600">
                    {source === "webapp" ? (
                      <span className="text-amber-800">
                        Disable the GAS trigger for {row.gasScript} before relying
                        on Webapp.
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        Webapp cron/hooks no-op — GAS handles this.
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
