import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

let dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.warn("WARNING: DATABASE_URL is not set. Database connection will fail until configured.");
  dbUrl = "postgres://dummy:dummy@dummy/dummy"; // fallback for module load
}

export const pool = new Pool({ connectionString: dbUrl });
export const db = drizzle({ client: pool, schema });