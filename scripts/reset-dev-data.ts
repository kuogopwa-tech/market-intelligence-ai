import { db, predictionsTable, learningMemoryTable } from "../lib/db/src";

async function resetDevData() {
  console.log("Starting development data reset via script...");
  
  try {
    // Delete predictions
    const deletedPredictions = await db.delete(predictionsTable).returning({ id: predictionsTable.id });
    console.log(`Deleted ${deletedPredictions.length} predictions.`);

    // Delete learning memory
    const deletedMemory = await db.delete(learningMemoryTable).returning({ id: learningMemoryTable.id });
    console.log(`Deleted ${deletedMemory.length} learning memory entries.`);

    console.log("Reset completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Reset failed:", err);
    process.exit(1);
  }
}

resetDevData();
