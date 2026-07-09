export type LoggerItemInput = {
  itemType: "Part" | "Panel";
  qty: string;
  description: string;
  rpCode?: string;
  itemNotes?: string;
};

export type LoggerFormInput = {
  market: string;
  urgency: "standard" | "urgent";
  model: string;
  boothId: string;
  color: string;
  issueType: string;
  notes: string;
  client: string;
  address: string;
  recipient: string;
  phone: string;
  email: string;
  items: LoggerItemInput[];
};

export function normalizeLoggerItems(items: LoggerItemInput[]): LoggerItemInput[] {
  const out: LoggerItemInput[] = [];
  for (const item of items) {
    const itemType = item.itemType;
    const qty = (item.qty ?? "").trim() || "1";
    const description = (item.description ?? "").trim();
    const rpCode = itemType === "Part" ? (item.rpCode ?? "").trim() : "";
    const itemNotes = (item.itemNotes ?? "").trim();
    if (!itemType || !qty || !description) continue;
    if (itemType === "Part") {
      const hasValidCode = /^\d{4}$/.test(rpCode);
      if (!hasValidCode && !description) continue;
    }
    out.push({ itemType, qty, description, rpCode, itemNotes });
  }
  return out;
}

export function hasMixedItemTypes(items: LoggerItemInput[]): boolean {
  let hasPart = false;
  let hasPanel = false;
  for (const item of items) {
    if (item.itemType === "Part") hasPart = true;
    if (item.itemType === "Panel") hasPanel = true;
    if (hasPart && hasPanel) return true;
  }
  return false;
}

/** Multiple parts only → one RP; otherwise one RP per line item. */
export function shouldSplitItemsIntoSeparateRps(items: LoggerItemInput[]): boolean {
  if (items.length <= 1) return false;
  return !items.every((item) => item.itemType === "Part");
}

export function isStockModel(model: string): boolean {
  return model.trim().toUpperCase() === "STOCK";
}

export function mapBoothModelToAbbreviation(modelValue: string): string {
  const model = modelValue.trim().toLowerCase();
  if (model === "stock") return "Other";
  const lookup: Record<string, string> = {
    soho: "SO",
    workstation: "WS",
    workstaiton: "WS",
    "camden 2": "C2",
    "camden 4": "C4",
    "haven one": "H.O",
    "haven focus": "H.F",
    "haven two": "H.2",
    "haven four": "H.4",
  };
  return lookup[model] ?? modelValue.trim();
}

export function mapAbbreviationToBoothModel(storedModel: string): string {
  const normalized = storedModel.trim().toUpperCase();
  const lookup: Record<string, string> = {
    SO: "Soho",
    WS: "Workstation",
    C2: "Camden 2",
    C4: "Camden 4",
    "H.O": "Haven One",
    "H.F": "Haven Focus",
    "H.2": "Haven Two",
    "H.4": "Haven Four",
    OTHER: "STOCK",
  };
  return lookup[normalized] ?? storedModel.trim();
}

export function formatItemTypeForSheet(
  items: LoggerItemInput[],
  modelValue: string,
): string {
  if (isStockModel(modelValue)) return "STOCK";
  if (!items.length) return "";
  if (items.length > 1) return "PARTS";
  const first = items[0];
  if (first.itemType === "Part") return "PARTS";
  return first.description;
}

function joinMultiLine(values: string[]): string {
  return values.filter(Boolean).join("\n");
}

export function formatQuantityColumn(items: LoggerItemInput[]): string {
  if (!items.length) return "";
  if (items.length > 1) return "Multiple, please take care";
  return items[0].qty;
}

export function formatPartCodeColumn(items: LoggerItemInput[]): string {
  if (!items.length) return "";
  if (items.length === 1) return items[0].rpCode ?? "";
  return joinMultiLine(items.map((item) => item.rpCode ?? ""));
}

export function formatDescriptionColumn(items: LoggerItemInput[]): string {
  if (!items.length) return "";
  if (items.length === 1) {
    const item = items[0];
    if (item.itemType !== "Part") return item.description;
    return `${item.qty} x ${item.description}`;
  }
  return joinMultiLine(
    items.map((item) => `${item.qty} x ${item.description}`),
  );
}

export function formatClarificationsColumn(items: LoggerItemInput[]): string {
  if (!items.length) return "";
  if (items.length === 1) {
    const item = items[0];
    if (item.itemType !== "Part") return item.itemNotes ?? "";
    const partRef = item.rpCode || item.description;
    return `${item.qty} x ${partRef} - "${item.itemNotes ?? ""}"`;
  }
  return joinMultiLine(
    items.map((item) => {
      const partRef = item.rpCode || item.description;
      return `${item.qty} x ${partRef} - "${item.itemNotes ?? ""}"`;
    }),
  );
}

export function assertRpReasonWhenRequired(
  issueType: string,
  notes: string,
): void {
  const required = new Set(["Factory Mistake", "Faulty Unit", "Other"]);
  if (required.has(issueType.trim()) && !notes.trim()) {
    throw new Error("Notes are required for this issue type.");
  }
}
