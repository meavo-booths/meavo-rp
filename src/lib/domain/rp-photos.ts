import { put } from "@vercel/blob";

import type { LoggerItemInput } from "@/lib/domain/rp-form-mapper";
import { loadServerEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const ISSUE_TYPES_REQUIRING_PHOTO = new Set(["Factory Mistake", "Faulty Unit"]);
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export type RpPhotoUploadInput = {
  itemIndex: number;
  base64: string;
  mimeType: string;
  fileName: string;
};

export function issueTypeRequiresRpPhoto(issueType: string): boolean {
  return ISSUE_TYPES_REQUIRING_PHOTO.has(issueType.trim());
}

export function itemRequiresRpPhoto(
  item: LoggerItemInput,
  issueType: string,
): boolean {
  if (!issueTypeRequiresRpPhoto(issueType)) return false;
  return item.itemType === "Panel";
}

function sanitizeRpNum(rpNum: string): string {
  return rpNum.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildPhotoFileName(
  rpNum: string,
  index: number,
  originalName: string,
  mimeType: string,
): string {
  const base = sanitizeRpNum(rpNum);
  const ext =
    originalName.split(".").pop()?.toLowerCase() ||
    (mimeType.includes("pdf") ? "pdf" : "jpg");
  return `${base}-panel-${index + 1}.${ext}`;
}

export async function uploadRpPhotosForRequest(
  rpRequestId: string,
  rpNum: string,
  items: LoggerItemInput[],
  issueType: string,
  photos: RpPhotoUploadInput[],
): Promise<{ warnings: string[] }> {
  const warnings: string[] = [];
  if (!photos.length) return { warnings };

  if (!loadServerEnv().BLOB_READ_WRITE_TOKEN) {
    warnings.push("Photo storage is not configured (BLOB_READ_WRITE_TOKEN).");
    return { warnings };
  }

  const panelIndices = items
    .map((item, i) => (itemRequiresRpPhoto(item, issueType) ? i : -1))
    .filter((i) => i >= 0);

  for (const photo of photos) {
    if (!panelIndices.includes(photo.itemIndex)) continue;

    try {
      const buffer = Buffer.from(photo.base64, "base64");
      if (buffer.byteLength > MAX_PHOTO_BYTES) {
        warnings.push(`Photo ${photo.fileName} exceeds 10 MB limit.`);
        continue;
      }

      const fileName = buildPhotoFileName(
        rpNum,
        photo.itemIndex,
        photo.fileName,
        photo.mimeType,
      );
      const blob = await put(`rp-photos/${fileName}`, buffer, {
        access: "public",
        contentType: photo.mimeType || "application/octet-stream",
      });

      await prisma.rpPhoto.create({
        data: {
          rpRequestId,
          storageKey: blob.pathname,
          url: blob.url,
          label: `Panel ${photo.itemIndex + 1}`,
          mimeType: photo.mimeType,
          byteSize: buffer.byteLength,
        },
      });
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? error.message
          : `Failed to upload photo for item ${photo.itemIndex + 1}`,
      );
    }
  }

  return { warnings };
}

export async function uploadRpPhotosForSplitRps(
  rpNums: string[],
  items: LoggerItemInput[],
  issueType: string,
  photos: RpPhotoUploadInput[],
): Promise<{ warnings: string[] }> {
  const warnings: string[] = [];
  for (let i = 0; i < rpNums.length; i++) {
    const row = await prisma.rpRequest.findUnique({
      where: { rpNum: rpNums[i] },
    });
    if (!row) continue;
    const itemPhotos = photos.filter((p) => p.itemIndex === i);
    const result = await uploadRpPhotosForRequest(
      row.id,
      rpNums[i],
      [items[i]],
      issueType,
      itemPhotos,
    );
    warnings.push(...result.warnings);
  }
  return { warnings };
}
