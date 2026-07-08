import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api/require-session";
import { getAddressBookEntries } from "@/lib/reference-data/sheets";

export async function GET() {
  const authResult = await requireApiSession();
  if ("error" in authResult) return authResult.error;

  try {
    const entries = await getAddressBookEntries();
    return NextResponse.json({ entries });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load address book";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
