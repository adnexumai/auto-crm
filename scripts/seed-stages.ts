import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { db } from "../src/db";
import { pipelineStages } from "../src/db/schema";
import { sql } from "drizzle-orm";

const stages = [
  { name: "Prospecto",       order: 1, color: "#64748b", isWon: false, isLost: false },
  { name: "Contactado",      order: 2, color: "#3b82f6", isWon: false, isLost: false },
  { name: "Propuesta",       order: 3, color: "#f59e0b", isWon: false, isLost: false },
  { name: "Negociacion",     order: 4, color: "#8b5cf6", isWon: false, isLost: false },
  { name: "Cerrado Ganado",  order: 5, color: "#22c55e", isWon: true,  isLost: false },
  { name: "Cerrado Perdido", order: 6, color: "#ef4444", isWon: false, isLost: true  },
];

async function main() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(pipelineStages);
  if (Number(count) > 0) {
    console.log(`pipeline_stages ya tiene ${count} registros. Nada que hacer.`);
    return;
  }

  await db.insert(pipelineStages).values(stages);
  console.log(`✓ Insertadas ${stages.length} etapas de pipeline.`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
