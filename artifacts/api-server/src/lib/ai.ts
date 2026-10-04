import fs from "fs/promises";
import path from "path";
import { PDFParse } from "pdf-parse";
import { db } from "@workspace/db";
import { paperContentsTable, paperEmbeddingsTable } from "@workspace/db/schema";
import { newId } from "./researchsphere";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export async function processPaperEmbedding(
  paperVersionId: string,
  objectPath: string
) {
  try {
    // 1. Extract text from the PDF file
    const uploadDir = path.resolve(process.cwd(), "uploads");
    const filePath = path.join(uploadDir, objectPath);
    const dataBuffer = await fs.readFile(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    let extractedText = "";
    try {
      extractedText = (await parser.getText()).text.trim();
    } finally {
      await parser.destroy();
    }

    if (!extractedText) {
      throw new Error("No text extracted from PDF");
    }

    // 2. Save extracted text
    await db.insert(paperContentsTable).values({
      id: newId(),
      paperVersionId,
      extractedText,
      extractionStatus: "COMPLETED",
    });

    // 3. Request embeddings from Python AI service
    const response = await fetch(`${AI_SERVICE_URL}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: extractedText.substring(0, 8000) }), // truncate for token limit if necessary
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI service failed: ${response.status} ${errorText}`);
    }

    const { embedding, model, dimensions } = (await response.json()) as any;

    // 4. Save embeddings
    await db.insert(paperEmbeddingsTable).values({
      id: newId(),
      paperVersionId,
      embedding,
      modelName: model,
      modelVersion: "1.0",
    });

    console.log(`Successfully generated embeddings for paper version ${paperVersionId}`);
  } catch (error) {
    console.error(`Failed to process embeddings for paper version ${paperVersionId}:`, error);
    // Mark as failed if we at least have a record, but for now just logging is fine
  }
}

export async function embedQuery(text: string): Promise<number[]> {
  const response = await fetch(`${AI_SERVICE_URL}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI service failed: ${response.status} ${errorText}`);
  }

  const { embedding } = (await response.json()) as any;
  return embedding;
}
