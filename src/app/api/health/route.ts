import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      service: "meavo-rp",
      version: "0.2.0",
      db: "ok",
    });
  } catch (error) {
    console.error("health check failed:", error);
    return NextResponse.json(
      { ok: false, service: "meavo-rp", db: "error" },
      { status: 503 },
    );
  }
}
