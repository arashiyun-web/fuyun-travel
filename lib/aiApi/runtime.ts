import { prisma } from '@/lib/prisma';
import { notifyBooking } from './notify';
import { createAiStore, type SqlDatabase } from './store';
import { AiApiService } from './service';
import type { Prisma } from '@prisma/client';
function adapter(client: Prisma.TransactionClient): SqlDatabase {
  return {
    query: <T>(sql: string, values: unknown[] = []) => client.$queryRawUnsafe<T[]>(sql, ...values),
    // Only the outer Prisma client opens transactions; nested work uses the existing transaction.
    transaction: fn => fn(adapter(client)),
  };
}
export const aiDatabase: SqlDatabase = {
  ...adapter(prisma),
  transaction: fn => prisma.$transaction(tx => fn(adapter(tx)), { timeout: 15000 }),
};
export const aiApi = new AiApiService(createAiStore(aiDatabase), notifyBooking);
