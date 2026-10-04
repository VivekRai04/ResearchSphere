import { db, papersTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";

async function backfill() {
  console.log("Starting backfill for existing papers...");
  const papers = await db.select().from(papersTable).where(isNull(papersTable.readingTime));
  
  console.log(`Found ${papers.length} papers to update.`);

  for (const paper of papers) {
    const text = (paper.abstract || "") + " " + (paper.title || "");
    const words = text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    
    // Fallback: If it's a seed paper and only has an abstract, reading time based on abstract alone is too small. 
    // Typical papers are ~5000-8000 words. Let's estimate based on abstract length if it's a seed paper 
    // without a PDF. A 200-word abstract often represents a 5000-word paper (25 min read).
    // Let's multiply the abstract word count by 25 to estimate full paper length.
    let estimatedWords = wordCount;
    if (!paper.objectPath && wordCount > 0) {
       estimatedWords = wordCount * 25;
    }
    
    const readingTime = Math.max(1, Math.ceil(estimatedWords / 200));
    const avgWordLength = words.reduce((acc, w) => acc + w.length, 0) / (words.length || 1);
    const complexity = avgWordLength > 6.5 ? "Advanced" : avgWordLength > 5.5 ? "Intermediate" : "Beginner";
    
    await db.update(papersTable)
      .set({ readingTime, complexity })
      .where(eq(papersTable.id, paper.id));
      
    console.log(`Updated paper ${paper.id}: ${readingTime} min, ${complexity} (avg len: ${avgWordLength.toFixed(2)})`);
  }
  
  console.log("Backfill complete.");
}

backfill().catch(console.error).finally(() => process.exit(0));
