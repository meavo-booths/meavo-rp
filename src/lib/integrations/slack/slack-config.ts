/** Slack user IDs from legacy GAS configs. */
export const SLACK_USER_IDS = {
  nikolay: "U0920BXJVMG",
  stefan: "U06U9A2FC79",
  ivan: "U08ASTEPQ9G",
  yavor: "U06T0MES8S2",
  boyan: "U09FR79K2CB",
  kalin: "U01KQQ1NQMB",
} as const;

export const SLACK_CHANNELS = {
  urgent: process.env.SLACK_URGENT_CHANNEL ?? "C0B2MLZRP2T",
  logistics: process.env.SLACK_LOGISTICS_CHANNEL ?? "C0B36PBQQP6",
} as const;

export const PANEL_ORDER_DM_RECIPIENTS = {
  urgent: [SLACK_USER_IDS.boyan, SLACK_USER_IDS.yavor],
  standard: [SLACK_USER_IDS.boyan, SLACK_USER_IDS.kalin],
  workshopNoteWarn: [SLACK_USER_IDS.boyan, SLACK_USER_IDS.kalin],
} as const;

export const UNBRIEFED_ESCALATION_USER_IDS: Record<number, string[]> = {
  1: [SLACK_USER_IDS.yavor],
  4: [SLACK_USER_IDS.boyan, SLACK_USER_IDS.yavor],
  8: [SLACK_USER_IDS.boyan, SLACK_USER_IDS.yavor],
};

export const PRODUCTION_WARNING_USER_IDS = [
  SLACK_USER_IDS.boyan,
  SLACK_USER_IDS.yavor,
];

export const RP_SLACK_CONFIG = {
  nikolayAksDmUserId: SLACK_USER_IDS.nikolay,
  urgentPartFactoryInstantUserId: SLACK_USER_IDS.kalin,
  urgentPartFactoryDelayedUserId: SLACK_USER_IDS.boyan,
  urgentPartFactoryDelayedAfterHours: 1,
  dailyMissingFactoryDigestHour: 15,
  dailyMissingFactoryReminderHour: 16,
  channelId: SLACK_CHANNELS.urgent,
  logisticsChannelId: SLACK_CHANNELS.logistics,
} as const;

export const PART_ITEM_VALUES = new Set([
  "PART",
  "PARTS",
  "SPARE",
  "STOCK",
  "OTHER PARTS",
]);

export const FACTORY_DEADLINE_RULES = {
  AKS: [
    {
      id: "panel_lead_deadline_bg",
      itemFilter: "panels" as const,
      daysBefore: 2,
      includeDeadlineDay: true,
      repeatAfterDeadline: true,
      repeatDaysAfterDeadline: 1,
      messageLocale: "bg" as const,
      userIds: [SLACK_USER_IDS.nikolay],
    },
    {
      id: "all_one_day_after",
      itemFilter: "all" as const,
      startDaysOverdue: 1,
      repeatDays: 2,
      userIds: [SLACK_USER_IDS.ivan, SLACK_USER_IDS.yavor, SLACK_USER_IDS.boyan],
    },
  ],
  KAZ: [
    {
      id: "all_lead_deadline_bg",
      itemFilter: "all" as const,
      daysBefore: 2,
      includeDeadlineDay: true,
      repeatAfterDeadline: true,
      repeatDaysAfterDeadline: 1,
      messageLocale: "bg" as const,
      userIds: [SLACK_USER_IDS.stefan],
    },
    {
      id: "all_one_day_after",
      itemFilter: "all" as const,
      startDaysOverdue: 1,
      repeatDays: 2,
      userIds: [SLACK_USER_IDS.kalin, SLACK_USER_IDS.yavor, SLACK_USER_IDS.boyan],
    },
  ],
  VAR: [
    {
      id: "all_deadline_day",
      itemFilter: "all" as const,
      startDaysOverdue: 0,
      repeatDays: 2,
      userIds: [SLACK_USER_IDS.yavor, SLACK_USER_IDS.boyan, SLACK_USER_IDS.ivan],
    },
  ],
} as const;

export const FACTORY_ALIASES: Record<string, string> = {
  VS: "VAR",
  AS: "AKS",
  KS: "KAZ",
};

export const FACTORY_DEADLINE_EXCLUDED_STATUSES = new Set([
  "SHIPPED",
  "CANCELLED",
  "READY",
  "SUPPLY",
]);
