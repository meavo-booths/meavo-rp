/**
 * Rep.Parts26 column indices (0-based). Keep in sync with legacy GAS COLUMN_MAP.
 */

export const RP_COLUMN = {
  RP_NUM: 0,
  ENTRY_DATE: 1,
  DUE_DATE: 2,
  MARKET: 3,
  USER_ID: 4,
  ISSUE_TYPE: 5,
  URGENCY: 6,
  MODEL: 7,
  BOOTH_ID: 8,
  COLOR: 9,
  ITEM_TYPE: 10,
  QUANTITY: 11,
  PART_RP_CODE: 12,
  PART_DESCRIPTION: 13,
  CLARIFICATIONS: 14,
  NOTES: 15,
  CLIENT: 16,
  ADDRESS: 17,
  RECIPIENT: 18,
  PHONE: 19,
  EMAIL: 20,
  REVIEW_GROUP: 21,
  SHIP_METHOD: 22,
  STATUS: 23,
  TRACKING: 24,
  READY_MARKED: 25,
  PAYER: 26,
  CURRENT_LOCATION: 27,
  RP_PHOTO: 28,
  WORKSHOP_NOTE: 29,
  ORDER_SENT: 30,
} as const;

/** Internal Production tab columns (0-based). Matches GAS INTERNAL_PRODUCTION_COL (1-based).
 *  Column O (index 14) is unused — Factory is N, Status starts at P. */
export const IP_COLUMN = {
  IP_NUM: 0,
  ENTRY_DATE: 1,
  DEADLINE: 2,
  OWNER_EMAIL: 3,
  REASON: 4,
  URGENCY: 5,
  MODEL: 6,
  BATCH: 7,
  COLOUR: 8,
  PANEL: 9,
  PANEL_CLARIFICATION: 10,
  NOTES: 11,
  WAREHOUSE: 12,
  FACTORY: 13,
  // 14 = O — unused gap in the sheet
  STATUS: 15, // P
  TRACKING: 16, // Q
  PAYER: 17, // R
  SOURCE_RP: 18, // S
  WORKSHOP_NOTE: 19, // T
  ORDER_SENT: 20, // U
} as const;

export const RP_LAST_COLUMN = RP_COLUMN.ORDER_SENT;
export const IP_LAST_COLUMN = IP_COLUMN.ORDER_SENT;

export type RpColumnKey = keyof typeof RP_COLUMN;
export type IpColumnKey = keyof typeof IP_COLUMN;
