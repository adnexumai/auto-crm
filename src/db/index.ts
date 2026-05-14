import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

let _db: LibSQLDatabase<typeof schema> | null = null;

/**
 * Lazy-init Drizzle/Turso client.
 * Only throws when actually used — not at import time.
 * This allows Supabase-only routes to work without TURSO_DATABASE_URL.
 */
export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_target, prop) {
    if (!_db) {
      if (!process.env.TURSO_DATABASE_URL) {
        throw new Error(
          "TURSO_DATABASE_URL no definida. Las rutas CRM (contacts/deals/activities) requieren Turso. Las rutas de prospeccion usan Supabase."
        );
      }
      const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
      _db = drizzle(client, { schema });
    }
    return (_db as unknown as Record<string | symbol, unknown>)[prop];
  },
});
