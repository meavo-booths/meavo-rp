import type { Prisma, PrismaClient } from "@prisma/client";

/** Prisma client or interactive transaction handle. */
export type DbExecutor = PrismaClient | Prisma.TransactionClient;
