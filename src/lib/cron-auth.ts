import type { NextRequest } from "next/server";

export function isAuthorizedCronRequest(request: NextRequest | Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === "development";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
