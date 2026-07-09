import type { Prisma, RpUrgency } from "@prisma/client";

import { mintNextIpNum } from "@/lib/domain/ip-numbers";
import { enqueueSheetSync } from "@/lib/domain/panel-orders";
import { mapBoothModelToAbbreviation } from "@/lib/domain/rp-form-mapper";
import { computeShippingDeadlineFromUrgency } from "@/lib/domain/working-days";
import { prisma } from "@/lib/prisma";

export type IpPanelInput = {
  panel: string;
  clarification?: string;
};

export type IpLoggerFormInput = {
  urgency: string;
  reason: string;
  reasonOther?: string;
  model: string;
  batch: string;
  color: string;
  panels: IpPanelInput[];
};

function normalizeUrgency(value: string): RpUrgency | null {
  const raw = value.trim().toLowerCase();
  if (["urgent", "спешна", "спешно"].includes(raw)) return "urgent";
  if (["standard", "стандартна", "стандартно"].includes(raw)) return "standard";
  return null;
}

function normalizeReason(reason: string, reasonOther?: string): string {
  const raw = reason.trim();
  if (!raw) return "";
  if (raw.toLowerCase() === "other") {
    return (reasonOther ?? "").trim();
  }
  return raw;
}

export async function processNewIpEntry(
  form: IpLoggerFormInput,
  userEmail: string,
): Promise<{ ipNums: string[] }> {
  const urgency = normalizeUrgency(form.urgency);
  if (!urgency) throw new Error("Спешност е задължителна.");

  const reason = normalizeReason(form.reason, form.reasonOther);
  if (!reason) throw new Error("Причина е задължителна.");

  const modelLabel = form.model.trim();
  if (!modelLabel) throw new Error("Модел на кабина е задължителен.");

  const batch = form.batch.trim();
  if (!batch) throw new Error("Партида е задължителна.");

  const color = form.color.trim();
  if (!color) throw new Error("Цвят е задължителен.");

  const panels = (form.panels ?? []).filter((p) => p.panel?.trim());
  if (!panels.length) throw new Error("Поне един панел е задължителен.");

  const modelAbbrev = mapBoothModelToAbbreviation(modelLabel);
  const entryDate = new Date();
  const deadline = computeShippingDeadlineFromUrgency(urgency, entryDate);
  const createdIpNums: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const panel of panels) {
      const ipNum = await mintNextIpNum(tx);
      const data: Prisma.RpInternalProductionRowCreateInput = {
        ipNum,
        entryDate,
        deadline,
        ownerEmail: userEmail.trim().toLowerCase(),
        reason,
        urgency,
        model: modelAbbrev,
        batch,
        colour: color,
        panel: panel.panel.trim(),
        panelClarification: (panel.clarification ?? "").trim(),
        factory: "AKS",
        status: "Briefed",
        updatedAt: entryDate,
      };
      const created = await tx.rpInternalProductionRow.create({ data });
      createdIpNums.push(ipNum);
      await enqueueSheetSync("ip", created.id, "upsert", tx);
    }
  });

  return { ipNums: createdIpNums };
}
