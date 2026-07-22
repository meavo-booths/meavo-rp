"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { requireActionSession } from "@/lib/api/require-session";
import { assertAdmin, isMeavoSimulationEmail, normalizeSimulationEmail } from "@/lib/domain/authz";
import type { LoggerFormInput } from "@/lib/domain/rp-form-mapper";
import { normalizeLoggerItems, shouldSplitItemsIntoSeparateRps } from "@/lib/domain/rp-form-mapper";
import { processNewRpEntry, cancelRpRequest } from "@/lib/domain/rp-create";
import {
  claimSubmitKey,
  completeSubmitKey,
  releaseSubmitKey,
} from "@/lib/domain/logger-submit-idempotency";
import type { RpPhotoUploadInput } from "@/lib/domain/rp-photos";
import {
  uploadRpPhotosForRequest,
  uploadRpPhotosForSplitRps,
} from "@/lib/domain/rp-photos";
import { updateExistingRpEntry } from "@/lib/domain/rp-update";
import { RP_TOOL_CARD_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { signOut } from "@/lib/auth";
import { resolveViewerContext, SIMULATE_COOKIE } from "@/lib/viewer-context";

export type ActionResult = {
  error?: string;
  rpNum?: string;
  rpNums?: string[];
  photoWarnings?: string[];
  /** After simulate apply/clear — client should navigate here. */
  redirectTo?: string;
};

async function attachPhotos(
  rpNums: string[],
  form: LoggerFormInput,
  photos?: RpPhotoUploadInput[],
): Promise<string[]> {
  if (!photos?.length) return [];
  const items = normalizeLoggerItems(form.items);
  if (shouldSplitItemsIntoSeparateRps(items)) {
    const result = await uploadRpPhotosForSplitRps(
      rpNums,
      items,
      form.issueType,
      photos,
    );
    return result.warnings;
  }
  const row = await prisma.rpRequest.findUnique({
    where: { rpNum: rpNums[0] },
  });
  if (!row) return [];
  const result = await uploadRpPhotosForRequest(
    row.id,
    rpNums[0],
    items,
    form.issueType,
    photos,
  );
  return result.warnings;
}

export async function createRpAction(
  form: LoggerFormInput,
  photos?: RpPhotoUploadInput[],
  submitKey?: string,
): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  let claimed = false;
  try {
    if (submitKey) {
      const claim = await claimSubmitKey("rp", submitKey);
      if (claim.kind === "hit") {
        return { rpNum: claim.nums[0], rpNums: claim.nums };
      }
      if (claim.kind === "busy") {
        return { error: "Submit already in progress — please wait" };
      }
      claimed = true;
    }
    const result = await processNewRpEntry(form, viewer.effectiveEmail);
    if (submitKey) {
      await completeSubmitKey("rp", submitKey, result.rpNums);
    }
    const photoWarnings = await attachPhotos(result.rpNums, form, photos);
    revalidatePath("/dashboard");
    return {
      rpNum: result.rpNums[0],
      rpNums: result.rpNums,
      photoWarnings: photoWarnings.length ? photoWarnings : undefined,
    };
  } catch (error) {
    if (claimed && submitKey) {
      await releaseSubmitKey("rp", submitKey);
    }
    return {
      error: error instanceof Error ? error.message : "Failed to create RP",
    };
  }
}

export async function updateRpAction(
  form: LoggerFormInput & { rpNum: string },
  photos?: RpPhotoUploadInput[],
): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  try {
    await updateExistingRpEntry(form, viewer.effectiveEmail);
    const photoWarnings = await attachPhotos([form.rpNum], form, photos);
    revalidatePath("/dashboard");
    return {
      rpNum: form.rpNum,
      photoWarnings: photoWarnings.length ? photoWarnings : undefined,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update RP",
    };
  }
}

export async function cancelRpAction(rpNum: string): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  try {
    await cancelRpRequest(rpNum, viewer.effectiveEmail);
    revalidatePath("/dashboard");
    return {};
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to cancel RP",
    };
  }
}

export async function setSimulateEmailAction(email: string): Promise<ActionResult> {
  const { session } = await requireActionSession();
  try {
    assertAdmin(session.user?.email);
    const jar = await cookies();
    const normalized = normalizeSimulationEmail(email);
    if (!normalized) {
      jar.delete(SIMULATE_COOKIE);
      revalidatePath("/dashboard");
      revalidatePath("/admin", "layout");
      return { redirectTo: "/admin/dashboard" };
    }
    if (!isMeavoSimulationEmail(normalized)) {
      return { error: "Simulation email must be a valid @meavo.com address" };
    }

    const user = await prisma.user.findUnique({
      where: { email: normalized },
      select: {
        id: true,
        cardAccess: {
          where: { cardId: RP_TOOL_CARD_ID },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!user) {
      return {
        error: `No such user: ${normalized} is not in Meavo accounts`,
      };
    }
    if (!user.cardAccess.length) {
      return {
        error: `${normalized} exists but has no access to the RP tool`,
      };
    }

    jar.set(SIMULATE_COOKIE, normalized, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    revalidatePath("/dashboard");
    revalidatePath("/admin", "layout");
    const viewer = await resolveViewerContext(session.user!.email!);
    return { redirectTo: viewer.defaultDashboardPath };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Forbidden" };
  }
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
