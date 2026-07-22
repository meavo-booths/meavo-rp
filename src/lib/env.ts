import { z } from "zod";

const ServerEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3003"),
  DATABASE_URL: z.string().min(10).optional(),
  AUTH_SECRET: z.string().min(16).optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  RP_TOOL_CARD_ID: z.string().default("seed-rp-tool"),
  MEAVO_APP_KEY: z.string().default("rp"),
  GATEWAY_URL: z.string().url().default("https://meavo.app"),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  REP_PARTS_SPREADSHEET_ID: z.string().optional(),
  REP_PARTS_SHEET_NAME: z.string().default("Rep.Parts26"),
  INTERNAL_PRODUCTION_SHEET_NAME: z.string().default("Internal Production"),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_URGENT_CHANNEL: z.string().optional(),
  SLACK_RP_CHANNEL: z.string().optional(),
  SLACK_KAZ_PANEL_CHANNEL: z.string().optional(),
  SLACK_VAR_PANEL_CHANNEL: z.string().optional(),
  SLACK_LOGISTICS_CHANNEL: z.string().optional(),
  IZNOS_SPREADSHEET_ID: z.string().optional(),
  FREIGHT_SPREADSHEET_ID: z.string().optional(),
  RP_NOTIFICATIONS_FORCE_OFF: z.string().optional(),
  /** When "true", Neon → Google Sheet backup is disabled (cron + enqueue no-op). */
  RP_SHEET_SYNC_FORCE_OFF: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  /** Base URL of mrp.meavo.app for materials deduct API. */
  MRP_APP_URL: z.string().url().optional(),
  /** Shared bearer with meavo-mrp POST /api/stock/rp-deduct. */
  RP_MRP_DEDUCT_SECRET: z.string().min(16).optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

function nonEmptyEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => (entry[1] ?? "") !== "",
    ),
  );
}

export function loadServerEnv(): ServerEnv {
  const parsed = ServerEnvSchema.safeParse(nonEmptyEnv());
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${issues}`);
  }
  return parsed.data;
}

export function isGoogleAuthEnabled(env: ServerEnv): boolean {
  return Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
}

export function isRepPartsSheetConfigured(env: ServerEnv): boolean {
  return Boolean(
    env.REP_PARTS_SPREADSHEET_ID && env.GOOGLE_SERVICE_ACCOUNT_JSON,
  );
}

/** Kill-switch: Neon → Google Sheet backup (cron + enqueue) no-op. */
export function isSheetSyncForceOff(): boolean {
  return process.env.RP_SHEET_SYNC_FORCE_OFF === "true";
}
