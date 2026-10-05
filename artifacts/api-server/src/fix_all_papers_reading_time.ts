import { db, papersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PDFParse } from "pdf-parse";
import fs from "fs/promises";
import path from "path";

async function fixAllPapers() {
  console.log("Looking for all papers to re-evaluate reading time...");
  const papers = await db.select().from(papersTable);

  console.log(`Found ${papers.length} total papers to re-evaluate.`);

  for (const paper of papers) {
    try {
      let readingTime = 1;

      if (paper.objectPath) {
        // Recalculate using PDF text + numPages
        const fullPath = path.resolve(process.cwd(), 'uploads', paper.objectPath);
        const bytes = await fs.readFile(fullPath);
        const parser = new PDFParse({ data: bytes });
        
        let numPages = 1;
        let text = "";
        try {
          const doc = await (parser as any).load();
          numPages = doc.numPages || 1;
          text = (await parser.getText()).text;
        } finally {
          await parser.destroy();
        }

        const normalized = text.replace(/\0/g, " ").replace(/[ \t]+/g, " ").trim();
        const words = normalized.split(/\s+/);
        readingTime = Math.ceil(words.length / 200);
        
        // Fallback for scanned or image-heavy PDFs
        if (words.length / numPages < 100) {
          readingTime = Math.max(readingTime, numPages * 2);
        }
      } else {
        // Recalculate using abstract for seed papers without PDFs
        const text = (paper.abstract || "") + " " + (paper.title || "");
        const words = text.split(/\s+/).filter(Boolean);
        const wordCount = words.length;
        
        // Since seed papers only have abstracts, estimate full length by multiplying abstract word count
        // A typical 200-word abstract is for a ~5000-word paper (25 mins)
        const estimatedWords = wordCount > 0 ? wordCount * 25 : 0;
        readingTime = Math.ceil(estimatedWords / 200);
      }

      readingTime = Math.max(1, readingTime);

      if (readingTime !== paper.readingTime) {
         await db.update(papersTable)
           .set({ readingTime })
           .where(eq(papersTable.id, paper.id));
         console.log(`Updated paper ${paper.id}: was ${paper.readingTime} min, now ${readingTime} min`);
      } else {
         console.log(`Paper ${paper.id}: unchanged (${readingTime} min)`);
      }
    } catch (e) {
      console.error(`Error processing ${paper.id}:`, e);
    }
  }
  
  console.log("Fix complete.");
}

fixAllPapers().catch(console.error).finally(() => process.exit(0));
