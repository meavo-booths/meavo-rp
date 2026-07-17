import { prisma } from "@/lib/prisma";

export type AutomationKey =
  | "unbriefed_slack"
  | "kaz_panel_slack"
  | "var_panel_slack"
  | "rp_slack"
  | "factory_fill"
  | "export_sync"
  | "factory_deadline_slack";

export type AutomationSource = "gas" | "webapp";

export type AutomationSettingRow = {
  key: AutomationKey;
  label: string;
  description: string;
  gasScript: string;
  gasTriggerHint: string;
  cronPath?: string;
};

export const AUTOMATION_SETTING_ROWS: AutomationSettingRow[] = [
  {
    key: "unbriefed_slack",
    label: "Unbriefed urgent panels Slack",
    description: "Escalations + production timeline DMs for unbriefed urgent panels",
    gasScript: "UnbriefedUrgentPanelSlackBot.js",
    gasTriggerHint: "Time-driven: every 15 minutes",
    cronPath: "/api/cron/unbriefed-panels",
  },
  {
    key: "kaz_panel_slack",
    label: "KAZ panel order Slack",
    description: "Urgent PDF DMs + weekly standard batch + workshop-note warnings",
    gasScript: "KazPanelOrderSlackAutomation.js",
    gasTriggerHint: "Time-driven: every 2h + Mon 09:00 weekly + daily 10:00 workshop",
    cronPath: "/api/cron/kaz-panel-slack",
  },
  {
    key: "var_panel_slack",
    label: "VAR panel order Slack",
    description: "Weekly VAR panel PDF batch to Slack",
    gasScript: "VarPanelOrderSlackAutomation.js",
    gasTriggerHint: "Time-driven: Monday 09:00",
    cronPath: "/api/cron/var-panel-slack",
  },
  {
    key: "rp_slack",
    label: "RP Slack bot",
    description: "Urgent status channel, factory DMs, Nikolay DMs, pallet-ready pings",
    gasScript: "RPSlackBot.js",
    gasTriggerHint: "onEdit + time-driven sweeps/digests",
    cronPath: "/api/cron/rp-slack",
  },
  {
    key: "factory_deadline_slack",
    label: "Factory deadline Slack DMs",
    description: "Per-factory overdue deadline reminders",
    gasScript: "RPSlackBot.js (factory deadline)",
    gasTriggerHint: "Time-driven: daily 10:30 Mon–Fri",
    cronPath: "/api/cron/factory-deadline-slack",
  },
  {
    key: "factory_fill",
    label: "Factory fill automation",
    description: "Column V factory + Briefed / In Production rules",
    gasScript: "FactoryFillAutomation.js",
    gasTriggerHint: "onEdit + daily sweep 06:00",
    cronPath: "/api/cron/factory-fill",
  },
  {
    key: "export_sync",
    label: "Export automation (Износ / Freight)",
    description: "Sync shipped status + tracking from export sheets",
    gasScript: "ExportAutomation.js",
    gasTriggerHint: "Time-driven: daily",
    cronPath: "/api/cron/export-sync",
  },
];

const SETTINGS_KEY = "automation_settings";

export type AutomationSettingsMap = Record<AutomationKey, AutomationSource>;

function defaultSettings(): AutomationSettingsMap {
  return {
    unbriefed_slack: "gas",
    kaz_panel_slack: "gas",
    var_panel_slack: "gas",
    rp_slack: "gas",
    factory_fill: "gas",
    export_sync: "gas",
    factory_deadline_slack: "gas",
  };
}

export function isNotificationsForceOff(): boolean {
  return process.env.RP_NOTIFICATIONS_FORCE_OFF === "true";
}

export async function getAutomationSettings(): Promise<AutomationSettingsMap> {
  const defaults = defaultSettings();
  const row = await prisma.rpAutomationState.findUnique({
    where: { key: SETTINGS_KEY },
  });
  if (!row?.value) return defaults;
  try {
    const parsed = JSON.parse(row.value) as Partial<AutomationSettingsMap>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export async function saveAutomationSettings(
  patch: Partial<AutomationSettingsMap>,
): Promise<AutomationSettingsMap> {
  const current = await getAutomationSettings();
  const next = { ...current, ...patch };
  await prisma.rpAutomationState.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next), updatedAt: new Date() },
  });
  return next;
}

/** Force every automation back to GAS (no webapp Slack / cron side effects). */
export async function forceAllAutomationsToGas(): Promise<AutomationSettingsMap> {
  const next = defaultSettings();
  await prisma.rpAutomationState.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next), updatedAt: new Date() },
  });
  return next;
}

export async function shouldRunInWebapp(key: AutomationKey): Promise<boolean> {
  if (isNotificationsForceOff()) return false;
  const settings = await getAutomationSettings();
  return settings[key] === "webapp";
}

export async function getAutomationSource(
  key: AutomationKey,
): Promise<AutomationSource> {
  const settings = await getAutomationSettings();
  return settings[key];
}
