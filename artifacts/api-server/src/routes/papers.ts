import { createHash } from "node:crypto";
import { and, desc, eq, ilike, inArray, or, sql, not } from "drizzle-orm";
import { PDFParse } from "pdf-parse";
import {
  AddBookmarkResponse,
  GetMyProfileResponse,
  GetPaperResponse,
  ListMyBookmarksResponse,
  ListMySubmissionsResponse,
  ListPapersQueryParams,
  ListPapersResponse,
  PreviewPaperMetadataBody,
  PreviewPaperMetadataResponse,
  RemoveBookmarkResponse,
  ReviewPaperBody,
  ReviewPaperResponse,
  SubmitPaperBody,
  SubmitPaperResponse,
  SubmitPaperRevisionBody,
  SubmitPaperRevisionResponse,
  ListMyCollectionsResponse,
  CreateCollectionBody,
  CreateCollectionResponse,
} from "@workspace/api-zod";
import {
  bookmarksTable,
  db,
  departmentsTable,
  paperActivityTable,
  paperEmbeddingsTable,
  paperVersionsTable,
  paperCommentsTable,
  papersTable,
  reviewsTable,
  uploadsTable,
  usersTable,
  userProfilesTable,
  collectionsTable,
  collectionBookmarksTable,
  paperCitationsTable,
} from "@workspace/db";
import { Router, type IRouter, type Request, type Response } from "express";
import { ObjectStorageService } from "../lib/objectStorage";
import {
  displayName,
  ensureResearchProfile,
  getCurrentProfile,
  makeDemoPdf,
  newId,
  userCanAccessPaper,
} from "../lib/researchsphere";
import { rankByTfidf } from "../lib/semantic-search";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

function routeParam(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

type PaperWithNames = {
  paper: typeof papersTable.$inferSelect;
  departmentName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

async function loadPaperRows(where: ReturnType<typeof and> | undefined) {
  return db
    .select({
      paper: papersTable,
      departmentName: departmentsTable.name,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
    })
    .from(papersTable)
    .innerJoin(departmentsTable, eq(departmentsTable.id, papersTable.departmentId))
    .innerJoin(usersTable, eq(usersTable.id, papersTable.uploadedById))
    .where(where)
    .orderBy(desc(papersTable.createdAt));
}

async function serializePaper(row: PaperWithNames) {
  const dbVersions = await db
    .select({ 
      versionNumber: paperVersionsTable.versionNumber,
      objectPath: paperVersionsTable.objectPath,
      createdAt: paperVersionsTable.createdAt
    })
    .from(paperVersionsTable)
    .where(eq(paperVersionsTable.paperId, row.paper.id))
    .orderBy(desc(paperVersionsTable.versionNumber));
    
  const versions = dbVersions.map(v => ({
    versionNumber: v.versionNumber,
    objectPath: v.objectPath,
    createdAt: v.createdAt.toISOString(),
  }));

  const [review] = await db
    .select({ comments: reviewsTable.comments })
    .from(reviewsTable)
    .where(eq(reviewsTable.paperId, row.paper.id))
    .orderBy(desc(reviewsTable.createdAt))
    .limit(1);

  const dbComments = await db
    .select({
      id: paperCommentsTable.id,
      userId: paperCommentsTable.userId,
      content: paperCommentsTable.content,
      createdAt: paperCommentsTable.createdAt,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
    })
    .from(paperCommentsTable)
    .innerJoin(usersTable, eq(paperCommentsTable.userId, usersTable.id))
    .where(eq(paperCommentsTable.paperId, row.paper.id))
    .orderBy(desc(paperCommentsTable.createdAt));
    
  const comments = dbComments.map(c => ({
    id: c.id,
    userId: c.userId,
    userName: displayName(c.firstName, c.lastName, c.email),
    content: c.content,
    createdAt: c.createdAt.toISOString(),
  }));

  const [{ count: citedByCount }] = await db
    .select({ count: sql<number>`cast(count(${paperCitationsTable.id}) as integer)` })
    .from(paperCitationsTable)
    .where(eq(paperCitationsTable.citedPaperId, row.paper.id));

  return {
    id: row.paper.id,
    title: row.paper.title,
    abstract: row.paper.abstract,
    year: row.paper.year,
    departmentId: row.paper.departmentId,
    departmentName: row.departmentName,
    researchArea: row.paper.researchArea,
    paperType: row.paper.paperType,
    doi: row.paper.doi,
    objectPath: row.paper.objectPath,
    fileHash: row.paper.fileHash,
    keywords: row.paper.keywords ?? [],
    status: row.paper.status,
    uploadedById: row.paper.uploadedById,
    authorName: displayName(row.firstName, row.lastName, row.email),
    createdAt: row.paper.createdAt.toISOString(),
    versionNumber: versions[0]?.versionNumber ?? 1,
    versions,
    comments,
    latestReviewComment: review?.comments ?? null,
    citedByCount,
    readingTime: row.paper.readingTime,
    complexity: row.paper.complexity,
    rejectionReason: row.paper.rejectionReason,
  };
}

async function getPaper(id: string) {
  const [row] = await loadPaperRows(eq(papersTable.id, id));
  return row ? serializePaper(row as PaperWithNames) : null;
}

async function readUploadedPdf(userId: string, objectPath: string) {
  const [upload] = await db.select().from(uploadsTable)
    .where(and(eq(uploadsTable.userId, userId), eq(uploadsTable.objectPath, objectPath)))
    .limit(1);
  if (!upload) return null;
  const fs = await import('fs/promises');
  const path = await import('path');
  const fullPath = path.resolve(process.cwd(), 'uploads', objectPath);
  const bytes = await fs.readFile(fullPath);
  return { upload, bytes };
}

async function extractMetadata(bytes: Buffer, fileName: string) {
  const parser = new PDFParse({ data: bytes });
  let text = "";
  let numPages = 1;
  try {
    const doc = await (parser as any).load();
    numPages = doc.numPages || 1;
    text = (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
  const normalized = text.replace(/\0/g, " ").replace(/[ \t]+/g, " ").trim();
  if (normalized.length < 40) {
    throw new Error("This PDF contains too little selectable text to extract metadata.");
  }
  const rawLines = text.replace(/\0/g, " ").replace(/[ \t]+/g, " ").split(/\r?\n/).map((line) => line.trim());
  const isLikelyHeader = (line: string) => {
    const l = line.toLowerCase();
    return (
      l.startsWith('arxiv:') ||
      l.includes('doi:') ||
      l.includes('doi.org/') ||
      l.includes('ieee') ||
      l.includes('acm') ||
      l.includes('journal of') ||
      l.includes('proceedings of') ||
      l.includes('international conference') ||
      l.includes('volume ') ||
      l.includes('vol.') ||
      l.includes('issn') ||
      l.includes('copyright') ||
      l.includes('preprint submitted') ||
      l.includes('published in') ||
      l.includes('licensed under') ||
      /^\d+$/.test(l) ||
      /^\d{4}$/.test(l) ||
      /^[a-z]+ \d{4}$/.test(l) ||
      /^\d{1,2}\s+[a-z]+\s+\d{4}$/.test(l) ||
      line.split(' ').length < 3 ||
      /^(abstract|keywords?|introduction|background)\b/i.test(l)
    );
  };

  let titleLines: string[] = [];
  for (let i = 0; i < Math.min(rawLines.length, 50); i++) {
    const line = rawLines[i];
    if (!line) {
      if (titleLines.length > 0) break;
      continue;
    }
    if (titleLines.length === 0) {
      if (line.length > 8 && line.length < 220 && !isLikelyHeader(line)) {
        titleLines.push(line);
      }
    } else {
      if (line.includes('@') || /^(abstract|keywords?|introduction)\b/i.test(line)) {
        break;
      }
      titleLines.push(line);
      if (titleLines.join(" ").length > 220) break;
    }
  }

  const title = (titleLines.length > 0 ? titleLines.join(" ") : fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ")).slice(0, 220).trim();
  const abstractMatch = normalized.match(
    /abstract\s*[:\-]?\s*([\s\S]{80,12000}?)(?=\n\s*(?:keywords?|introduction|1\.?\s+introduction|index terms)\b)/i,
  );
  const abstract = (abstractMatch?.[1] ??
    normalized.slice(Math.max(0, normalized.indexOf(title) + title.length), 1600))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3500);
  const keywordMatch = normalized.match(/(?:keywords?|index terms)\s*[:\-]\s*([^\n]{1,400})/i);
  const keywords = (keywordMatch?.[1] ?? "")
    .split(/[,;•|]/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1)
    .slice(0, 12);
  
  const doiMatch = text.match(/\b(10\.\d{4,9}\/[-._;()/:a-zA-Z0-9]+)\b/);
  const doi = doiMatch ? doiMatch[1] : null;

  // Extract references
  const references: string[] = [];
  const refIndex = text.lastIndexOf("References");
  if (refIndex > 0) {
    const refsText = text.slice(refIndex + "References".length).trim();
    // basic splitting for numbering like "[1]", "[2]" or "1.", "2."
    const rawRefs = refsText.split(/(?:\[\d+\]|\n\s*\d+\.\s+)/).filter(r => r.length > 20).map(r => r.trim());
    references.push(...rawRefs.slice(0, 30)); // limit to 30
  }

  // Calculate reading time and complexity
  const words = normalized.split(/\s+/);
  let readingTime = Math.ceil(words.length / 200);
  
  // Fallback for scanned or image-heavy PDFs: assume ~2 mins per page if text density is low
  if (words.length / numPages < 100) {
    readingTime = Math.max(readingTime, numPages * 2);
  }
  readingTime = Math.max(1, readingTime);
  
  const avgWordLength = words.reduce((acc, w) => acc + w.length, 0) / (words.length || 1);
  const complexity = avgWordLength > 6.5 ? "Advanced" : avgWordLength > 5.5 ? "Intermediate" : "Beginner";

  return {
    title,
    abstract: abstract || normalized.slice(0, 1200),
    keywords,
    doi,
    fileHash: createHash("sha256").update(bytes).digest("hex"),
    references,
    readingTime,
    complexity,
  };
}

function isSignedIn(req: Request, res: Response): req is Request & { user: Express.User } {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Sign-in is required" });
    return false;
  }
  return true;
}

async function requireRole(
  req: Request,
  res: Response,
  roles: Array<"STUDENT" | "REVIEWER" | "ADMIN">,
) {
  if (!isSignedIn(req, res)) return null;
  const profile = await ensureResearchProfile(req.user);
  if (!roles.includes(profile.role)) {
    res.status(403).json({ error: "You do not have permission to do this" });
    return null;
  }
  return profile;
}

router.get("/me/profile", async (req: Request, res: Response) => {
  if (!isSignedIn(req, res)) return;
  const profile = await getCurrentProfile(req);
  if (!profile) {
    res.status(401).json({ error: "Sign-in is required" });
    return;
  }
  res.json(GetMyProfileResponse.parse(profile));
});

router.get("/papers", async (req: Request, res: Response) => {
  const parsed = ListPapersQueryParams.safeParse({
    ...req.query,
    semantic: req.query.semantic === "true",
    year: typeof req.query.year === "string" ? Number(req.query.year) : req.query.year,
  });
  const q = parsed.success ? parsed.data.q?.trim() ?? "" :
    (typeof req.query.q === "string" ? req.query.q.trim() : "");
  const semantic = parsed.success
    ? parsed.data.semantic ?? false
    : req.query.semantic === "true";
  const departmentId = parsed.success ? parsed.data.departmentId : undefined;
  const year = parsed.success ? parsed.data.year : undefined;
  const researchArea = parsed.success ? parsed.data.researchArea : undefined;
  const paperType = parsed.success ? parsed.data.paperType : undefined;
  const filters = [
    eq(papersTable.status, "APPROVED"),
    ...(departmentId ? [eq(papersTable.departmentId, departmentId)] : []),
    ...(year ? [eq(papersTable.year, year)] : []),
    ...(researchArea ? [eq(papersTable.researchArea, researchArea)] : []),
    ...(paperType ? [eq(papersTable.paperType, paperType)] : []),
  ];
  if (q && !semantic) {
    const pattern = `%${q}%`;
    const searchFilter = or(
      ilike(papersTable.title, pattern),
      ilike(papersTable.abstract, pattern),
      ilike(papersTable.researchArea, pattern),
      ilike(papersTable.paperType, pattern),
      ilike(usersTable.firstName, pattern),
      ilike(usersTable.lastName, pattern),
      ilike(sql<string>`${papersTable.keywords}::text`, pattern),
    );
    if (searchFilter) filters.push(searchFilter);
  }
  const rows = await loadPaperRows(and(...filters));
  let papers = await Promise.all(rows.map((row) => serializePaper(row as PaperWithNames)));
  if (q && semantic) {
    try {
      const { embedQuery } = await import("../lib/ai.js");
      const queryEmbedding = await embedQuery(q);
      
      const { sql } = await import("drizzle-orm");
      
      const closest = await db.select({
        paperId: paperVersionsTable.paperId,
      })
      .from(paperEmbeddingsTable)
      .innerJoin(paperVersionsTable, eq(paperEmbeddingsTable.paperVersionId, paperVersionsTable.id))
      .where(sql`${paperEmbeddingsTable.embedding} <=> ${JSON.stringify(queryEmbedding)} < 0.60`)
      .orderBy(sql`${paperEmbeddingsTable.embedding} <=> ${JSON.stringify(queryEmbedding)}`)
      .limit(15);
      
      const closestIds = closest.map(c => c.paperId);
      const semanticPapers = papers.filter((p: any) => closestIds.includes(p.id));
      semanticPapers.sort((a: any, b: any) => closestIds.indexOf(a.id) - closestIds.indexOf(b.id));
      
      const allEmbedded = await db.select({
        paperId: paperVersionsTable.paperId,
      })
      .from(paperEmbeddingsTable)
      .innerJoin(paperVersionsTable, eq(paperEmbeddingsTable.paperVersionId, paperVersionsTable.id));
      
      const allEmbeddedIds = new Set(allEmbedded.map(e => e.paperId));
      
      const unembeddedPapers = papers.filter((p: any) => !allEmbeddedIds.has(p.id));
      const rankedFallback = rankByTfidf(unembeddedPapers, q, (paper) =>
        `${paper.title} ${paper.abstract} ${paper.researchArea} ${paper.paperType} ${paper.keywords.join(" ")}`,
      )
      .filter(({ score }) => score > 0)
      .map(({ record }) => record);
      
      papers = [...semanticPapers, ...rankedFallback];
    } catch (error) {
      console.error("Semantic search failed, falling back to TF-IDF:", error);
      papers = rankByTfidf(papers, q, (paper) =>
        `${paper.title} ${paper.abstract} ${paper.researchArea} ${paper.paperType} ${paper.keywords.join(" ")}`,
      )
      .filter(({ score }) => score > 0)
      .map(({ record }) => record);
    }
  } else if (q) {
    // Standard keyword sorting
    papers = rankByTfidf(papers, q, (paper) =>
      `${paper.title} ${paper.abstract} ${paper.researchArea} ${paper.paperType} ${paper.keywords.join(" ")}`,
    ).map(({ record }) => record);
  }
  res.json(ListPapersResponse.parse(papers));
});

router.post("/papers/metadata-preview", async (req: Request, res: Response) => {
  if (!isSignedIn(req, res)) return;
  const parsed = PreviewPaperMetadataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose an uploaded PDF to preview" });
    return;
  }
  try {
    const upload = await readUploadedPdf(req.user.id, parsed.data.objectPath);
    if (!upload) {
      res.status(404).json({ error: "The upload was not found or belongs to another user" });
      return;
    }
    const metadata = await extractMetadata(upload.bytes, upload.upload.fileName);
    const [duplicate] = await db.select({ id: papersTable.id })
      .from(papersTable).where(
        and(
          eq(papersTable.fileHash, metadata.fileHash),
          not(eq(papersTable.status, "REJECTED"))
        )
      ).limit(1);
    await db.update(uploadsTable).set({ fileHash: metadata.fileHash })
      .where(eq(uploadsTable.id, upload.upload.id));
    res.json(PreviewPaperMetadataResponse.parse({
      ...metadata,
      duplicate: Boolean(duplicate),
    }));
  } catch (error) {
    req.log.warn({ err: error }, "Could not extract PDF metadata");
    res.status(400).json({
      error: error instanceof Error ? error.message : "Could not read this PDF",
    });
  }
});

router.post("/papers", async (req: Request, res: Response) => {
  if (!await requireRole(req, res, ["STUDENT", "REVIEWER", "ADMIN"])) return;
  const parsed = SubmitPaperBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Complete all required paper details" });
    return;
  }
  const values = parsed.data;
  const upload = await readUploadedPdf(req.user!.id, values.objectPath);
  if (!upload) {
    res.status(404).json({ error: "The uploaded PDF was not found" });
    return;
  }
  let fileHash: string;
  try {
    fileHash = createHash("sha256").update(upload.bytes).digest("hex");
  } catch {
    res.status(400).json({ error: "The uploaded PDF could not be read" });
    return;
  }
  const [existingPaper] = await db.select().from(papersTable).where(eq(papersTable.fileHash, fileHash)).limit(1);

  if (existingPaper) {
    if (existingPaper.status !== "REJECTED") {
      res.status(409).json({ error: "This PDF is already in the repository" });
      return;
    }
    // Update the existing rejected paper
    const [updatedPaper] = await db.update(papersTable).set({
      title: values.title.trim(),
      abstract: values.abstract.trim(),
      year: values.year,
      departmentId: values.departmentId,
      researchArea: values.researchArea,
      paperType: values.paperType,
      doi: values.doi || null,
      objectPath: values.objectPath,
      keywords: values.keywords,
      status: "PENDING_REVIEW",
      uploadedById: req.user!.id,
      updatedAt: new Date(),
    }).where(eq(papersTable.id, existingPaper.id)).returning();
    
    await db.update(uploadsTable).set({ fileHash, paperId: updatedPaper.id })
      .where(eq(uploadsTable.id, upload.upload.id));

    const response = await getPaper(updatedPaper.id);
    res.status(201).json(SubmitPaperResponse.parse(response));
    return;
  }

  const id = newId();
  const [paper] = await db.insert(papersTable).values({
    id,
    title: values.title.trim(),
    abstract: values.abstract.trim(),
    year: values.year,
    departmentId: values.departmentId,
    researchArea: values.researchArea,
    paperType: values.paperType,
    doi: values.doi || null,
    objectPath: values.objectPath,
    fileHash,
    keywords: values.keywords,
    status: "PENDING_REVIEW",
    uploadedById: req.user!.id,
  }).returning();
  const versionId = newId();
  await db.insert(paperVersionsTable).values({
    id: versionId,
    paperId: id,
    versionNumber: 1,
    objectPath: values.objectPath,
    fileHash,
  });
  await db.update(uploadsTable).set({ fileHash, paperId: id })
    .where(eq(uploadsTable.id, upload.upload.id));

  // Asynchronously process AI embeddings
  const { processPaperEmbedding } = await import("../lib/ai.js");
  processPaperEmbedding(versionId, values.objectPath).catch(console.error);

  // Asynchronously extract and save citations
  (async () => {
    try {
      const metadata = await extractMetadata(upload.bytes, upload.upload.fileName);
      
      // Update reading time and complexity
      await db.update(papersTable).set({
        readingTime: metadata.readingTime,
        complexity: metadata.complexity
      }).where(eq(papersTable.id, id));

      if (metadata.references?.length) {
        const insertPromises = metadata.references.map(async (ref) => {
          // Attempt to link citation if we find a paper with matching title
          let citedPaperId = null;
          // Very basic fuzzy matching using text search or exact match
          const [match] = await db.select({ id: papersTable.id })
            .from(papersTable)
            .where(sql`LOWER(${papersTable.title}) = LOWER(${ref.split('.').slice(-2)[0]?.trim() || ''})`)
            .limit(1);
          if (match) { citedPaperId = match.id; }
          
          await db.insert(paperCitationsTable).values({
            id: newId(),
            citingPaperId: id,
            citedPaperId,
            rawReferenceText: ref
          });
        });
        await Promise.allSettled(insertPromises);
      }
    } catch (e) {
      req.log.warn({ err: e }, "Could not extract citations");
    }
  })();

  const response = await getPaper(paper.id);
  res.status(201).json(SubmitPaperResponse.parse(response));
});
router.get("/papers/my-analytics", async (req: Request, res: Response) => {
  if (!isSignedIn(req, res)) return;
  
  const myPapers = await db.select({ id: papersTable.id, title: papersTable.title })
    .from(papersTable)
    .where(eq(papersTable.uploadedById, req.user.id));
    
  if (myPapers.length === 0) {
    res.json({ totalViews: 0, totalDownloads: 0, totalBookmarks: 0, papers: [] });
    return;
  }
  
  const paperIds = myPapers.map(p => p.id);
  
  const views = await db.select({
    paperId: paperActivityTable.paperId,
    count: sql<number>`cast(count(${paperActivityTable.id}) as integer)`,
  }).from(paperActivityTable)
    .where(and(eq(paperActivityTable.kind, "VIEW"), inArray(paperActivityTable.paperId, paperIds)))
    .groupBy(paperActivityTable.paperId);

  const downloads = await db.select({
    paperId: paperActivityTable.paperId,
    count: sql<number>`cast(count(${paperActivityTable.id}) as integer)`,
  }).from(paperActivityTable)
    .where(and(eq(paperActivityTable.kind, "DOWNLOAD"), inArray(paperActivityTable.paperId, paperIds)))
    .groupBy(paperActivityTable.paperId);

  const bookmarks = await db.select({
    paperId: bookmarksTable.paperId,
    count: sql<number>`cast(count(${bookmarksTable.id}) as integer)`,
  }).from(bookmarksTable)
    .where(inArray(bookmarksTable.paperId, paperIds))
    .groupBy(bookmarksTable.paperId);

  const viewMap = new Map(views.map(v => [v.paperId, v.count]));
  const downloadMap = new Map(downloads.map(d => [d.paperId, d.count]));
  const bookmarkMap = new Map(bookmarks.map(b => [b.paperId, b.count]));

  let totalViews = 0, totalDownloads = 0, totalBookmarks = 0;
  
  const papers = myPapers.map(p => {
    const pViews = viewMap.get(p.id) ?? 0;
    const pDowns = downloadMap.get(p.id) ?? 0;
    const pBooks = bookmarkMap.get(p.id) ?? 0;
    
    totalViews += pViews;
    totalDownloads += pDowns;
    totalBookmarks += pBooks;
    
    return {
      id: p.id,
      title: p.title,
      views: pViews,
      downloads: pDowns,
      bookmarks: pBooks,
    };
  });
  
  res.json({
    totalViews,
    totalDownloads,
    totalBookmarks,
    papers,
  });
});

router.get("/papers/:paperId", async (req: Request, res: Response) => {
  const [record] = await db.select().from(papersTable)
    .where(eq(papersTable.id, routeParam(req, "paperId"))).limit(1);
  if (!record || !await userCanAccessPaper(
    req.isAuthenticated() ? req.user.id : undefined,
    record,
  )) {
    res.status(404).json({ error: "Paper not found" });
    return;
  }
  const paper = await getPaper(record.id);
  if (!paper) {
    res.status(404).json({ error: "Paper not found" });
    return;
  }
  await db.insert(paperActivityTable).values({
    id: newId(),
    paperId: record.id,
    userId: req.isAuthenticated() ? req.user.id : null,
    kind: "VIEW",
  });
  const approvedRows = await loadPaperRows(eq(papersTable.status, "APPROVED"));
  const approved = await Promise.all(approvedRows.map((row) => serializePaper(row as PaperWithNames)));

  let related: any[] = [];
  try {
    // Attempt semantic vector search first
    const [latestVersion] = await db.select().from(paperVersionsTable)
      .where(eq(paperVersionsTable.paperId, paper.id))
      .orderBy(desc(paperVersionsTable.versionNumber)).limit(1);

    if (latestVersion) {
      const [embeddingRecord] = await db.select().from(paperEmbeddingsTable)
        .where(eq(paperEmbeddingsTable.paperVersionId, latestVersion.id)).limit(1);

      if (embeddingRecord && embeddingRecord.embedding) {
        // Find top 4 closest embeddings
        const { sql, not } = await import("drizzle-orm");

        // Use pgvector cosine distance operator <=>
        const closest = await db.select({
          paperId: paperVersionsTable.paperId,
        })
          .from(paperEmbeddingsTable)
          .innerJoin(paperVersionsTable, eq(paperEmbeddingsTable.paperVersionId, paperVersionsTable.id))
          .where(not(eq(paperVersionsTable.paperId, paper.id)))
          .orderBy(sql`${paperEmbeddingsTable.embedding} <=> ${JSON.stringify(embeddingRecord.embedding)}`)
          .limit(4);

        const closestIds = closest.map(c => c.paperId);
        related = approved.filter(p => closestIds.includes(p.id));
        // Sort to match the vector distance order
        related.sort((a, b) => closestIds.indexOf(a.id) - closestIds.indexOf(b.id));
      }
    }
  } catch (error) {
    console.error("Vector similarity failed, falling back to TF-IDF:", error);
  }

  // Fallback to TF-IDF if vector search didn't find anything
  if (related.length === 0) {
    related = rankByTfidf(
      approved.filter((candidate) => candidate.id !== paper.id),
      `${paper.title} ${paper.abstract} ${paper.keywords.join(" ")}`,
      (candidate) => `${candidate.title} ${candidate.abstract} ${candidate.keywords.join(" ")}`,
    ).slice(0, 4).map(({ record }) => record);
  }
  
  res.json(GetPaperResponse.parse({ paper, related }));
});

router.get("/papers/:paperId/download", async (req: Request, res: Response) => {
  const [paper] = await db.select().from(papersTable)
    .where(eq(papersTable.id, routeParam(req, "paperId"))).limit(1);
  if (!paper) {
    res.status(404).json({ error: "Paper not found" });
    return;
  }
  if (!await userCanAccessPaper(req.isAuthenticated() ? req.user.id : undefined, paper)) {
    res.status(req.isAuthenticated() ? 403 : 401).json({ error: "Sign-in is required to access this paper" });
    return;
  }
  await db.insert(paperActivityTable).values({
    id: newId(),
    paperId: paper.id,
    userId: req.isAuthenticated() ? req.user.id : null,
    kind: "DOWNLOAD",
  });
  if (!paper.objectPath) {
    res.type("application/pdf").setHeader(
      "Content-Disposition",
      `attachment; filename="${paper.id}.pdf"`,
    );
    res.send(makeDemoPdf(paper.title, paper.abstract));
    return;
  }
  const file = await objectStorage.getObjectEntityFile(paper.objectPath);
  const response = await objectStorage.downloadObject(file);
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (!response.body) {
    res.end();
    return;
  }
  const { Readable } = await import("node:stream");
  Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
});

router.post("/papers/:paperId/comments", async (req: Request, res: Response) => {
  if (!isSignedIn(req, res)) return;
  const content = req.body?.content;
  if (!content || typeof content !== "string" || content.trim() === "") {
    res.status(400).json({ error: "Comment content is required" });
    return;
  }

  const paperId = routeParam(req, "paperId");
  const [record] = await db.select().from(papersTable)
    .where(eq(papersTable.id, paperId)).limit(1);

  if (!record || record.status !== "APPROVED") {
    res.status(404).json({ error: "Published paper not found" });
    return;
  }

  await db.insert(paperCommentsTable).values({
    id: newId(),
    paperId,
    userId: req.user.id,
    content: content.trim(),
  });

  const paper = await getPaper(paperId);
  res.status(201).json(paper);
});

router.post("/papers/:paperId/versions", async (req: Request, res: Response) => {
  if (!isSignedIn(req, res)) return;
  const parsed = SubmitPaperRevisionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Complete the revision details" });
    return;
  }
  const [paper] = await db.select().from(papersTable)
    .where(eq(papersTable.id, routeParam(req, "paperId"))).limit(1);
  if (!paper || paper.uploadedById !== req.user!.id) {
    res.status(404).json({ error: "Revision request not found" });
    return;
  }
  if (paper.status !== "REVISION_REQUIRED") {
    res.status(400).json({ error: "This paper is not awaiting a revision" });
    return;
  }
  const upload = await readUploadedPdf(req.user.id, parsed.data.objectPath);
  if (!upload) {
    res.status(404).json({ error: "The uploaded revision PDF was not found" });
    return;
  }
  const fileHash = createHash("sha256").update(upload.bytes).digest("hex");
  const [duplicate] = await db.select({ id: papersTable.id }).from(papersTable)
    .where(eq(papersTable.fileHash, fileHash)).limit(1);
  if (duplicate && duplicate.id !== paper.id) {
    res.status(409).json({ error: "This PDF is already in the repository" });
    return;
  }
  const [latest] = await db.select({ versionNumber: paperVersionsTable.versionNumber })
    .from(paperVersionsTable).where(eq(paperVersionsTable.paperId, paper.id))
    .orderBy(desc(paperVersionsTable.versionNumber)).limit(1);
  const nextVersion = (latest?.versionNumber ?? 0) + 1;
  await db.transaction(async (tx) => {
    await tx.insert(paperVersionsTable).values({
      id: newId(),
      paperId: paper.id,
      versionNumber: nextVersion,
      objectPath: parsed.data.objectPath,
      fileHash,
    });
    await tx.update(papersTable).set({
      title: parsed.data.title.trim(),
      abstract: parsed.data.abstract.trim(),
      keywords: parsed.data.keywords,
      objectPath: parsed.data.objectPath,
      fileHash,
      status: "PENDING_REVIEW",
      updatedAt: new Date(),
    }).where(eq(papersTable.id, paper.id));
    await tx.update(uploadsTable).set({ fileHash, paperId: paper.id })
      .where(eq(uploadsTable.id, upload.upload.id));
  });
  res.status(201).json(SubmitPaperRevisionResponse.parse(await getPaper(paper.id)));
});

router.get("/me/submissions", async (req: Request, res: Response) => {
  if (!isSignedIn(req, res)) return;
  const rows = await loadPaperRows(eq(papersTable.uploadedById, req.user.id));
  const papers = await Promise.all(rows.map((row) => serializePaper(row as PaperWithNames)));
  res.json(ListMySubmissionsResponse.parse(papers));
});

router.get("/me/bookmarks", async (req: Request, res: Response) => {
  if (!isSignedIn(req, res)) return;
  const bookmarks = await db.select({ paperId: bookmarksTable.paperId })
    .from(bookmarksTable).where(eq(bookmarksTable.userId, req.user.id));
  if (!bookmarks.length) {
    res.json(ListMyBookmarksResponse.parse([]));
    return;
  }
  const rows = await loadPaperRows(and(
    inArray(papersTable.id, bookmarks.map((bookmark) => bookmark.paperId)),
    eq(papersTable.status, "APPROVED"),
  ));
  res.json(ListMyBookmarksResponse.parse(
    await Promise.all(rows.map((row) => serializePaper(row as PaperWithNames))),
  ));
});

router.put("/papers/:paperId/bookmark", async (req: Request, res: Response) => {
  if (!isSignedIn(req, res)) return;
  const [paper] = await db.select({ id: papersTable.id }).from(papersTable)
    .where(and(eq(papersTable.id, routeParam(req, "paperId")), eq(papersTable.status, "APPROVED")))
    .limit(1);
  if (!paper) {
    res.status(404).json({ error: "Approved paper not found" });
    return;
  }
  await db.insert(bookmarksTable).values({
    id: newId(),
    userId: req.user.id,
    paperId: paper.id,
  }).onConflictDoNothing();
  res.json(AddBookmarkResponse.parse({ bookmarked: true }));
});

router.delete("/papers/:paperId/bookmark", async (req: Request, res: Response) => {
  if (!isSignedIn(req, res)) return;
  await db.delete(bookmarksTable).where(and(
    eq(bookmarksTable.userId, req.user.id),
    eq(bookmarksTable.paperId, routeParam(req, "paperId")),
  ));
  res.json(RemoveBookmarkResponse.parse({ bookmarked: false }));
});

router.get("/review/queue", async (req: Request, res: Response) => {
  const profile = await requireRole(req, res, ["REVIEWER", "ADMIN"]);
  if (!profile) return;
  const rows = await loadPaperRows(or(
    eq(papersTable.status, "PENDING_REVIEW"),
    eq(papersTable.status, "REVISION_REQUIRED"),
  ));
  res.json(ListPapersResponse.parse(
    await Promise.all(rows.map((row) => serializePaper(row as PaperWithNames))),
  ));
});

router.post("/review/papers/:paperId", async (req: Request, res: Response) => {
  const profile = await requireRole(req, res, ["REVIEWER", "ADMIN"]);
  if (!profile) return;
  const parsed = ReviewPaperBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a review decision and add feedback" });
    return;
  }
  const [paper] = await db.select().from(papersTable)
    .where(eq(papersTable.id, routeParam(req, "paperId"))).limit(1);
  if (!paper) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.insert(reviewsTable).values({
      id: newId(),
      paperId: paper.id,
      reviewerId: req.user!.id,
      status: parsed.data.status,
      comments: parsed.data.comments.trim(),
    });
    await tx.update(papersTable).set({
      status: parsed.data.status,
      updatedAt: new Date(),
    }).where(eq(papersTable.id, paper.id));
  });
  res.json(ReviewPaperResponse.parse(await getPaper(paper.id)));
});

router.get("/me/collections", async (req: Request, res: Response) => {
  if (!isSignedIn(req, res)) return;
  const collections = await db.select().from(collectionsTable).where(eq(collectionsTable.userId, req.user.id)).orderBy(desc(collectionsTable.createdAt));
  
  const result = await Promise.all(collections.map(async (c) => {
    const cb = await db.select({ bookmarkId: collectionBookmarksTable.bookmarkId }).from(collectionBookmarksTable).where(eq(collectionBookmarksTable.collectionId, c.id));
    const bookmarks = cb.length ? await db.select({ paperId: bookmarksTable.paperId }).from(bookmarksTable).where(inArray(bookmarksTable.id, cb.map(x => x.bookmarkId))) : [];
    const rows = bookmarks.length ? await loadPaperRows(and(inArray(papersTable.id, bookmarks.map(b => b.paperId)), eq(papersTable.status, "APPROVED"))) : [];
    return {
      id: c.id,
      name: c.name,
      paperCount: rows.length,
      createdAt: c.createdAt.toISOString(),
      papers: await Promise.all(rows.map(row => serializePaper(row as PaperWithNames))),
    };
  }));
  res.json(ListMyCollectionsResponse.parse(result));
});

router.post("/me/collections", async (req: Request, res: Response) => {
  if (!isSignedIn(req, res)) return;
  const parsed = CreateCollectionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  
  const id = newId();
  await db.insert(collectionsTable).values({ id, userId: req.user.id, name: parsed.data.name });
  res.status(201).json(CreateCollectionResponse.parse({
    id, name: parsed.data.name, paperCount: 0, createdAt: new Date().toISOString(), papers: []
  }));
});

router.delete("/me/collections/:collectionId", async (req: Request, res: Response) => {
  if (!isSignedIn(req, res)) return;
  await db.delete(collectionsTable).where(and(eq(collectionsTable.id, routeParam(req, "collectionId")), eq(collectionsTable.userId, req.user.id)));
  res.status(200).json({});
});

router.put("/me/collections/:collectionId/papers/:paperId", async (req: Request, res: Response) => {
  if (!isSignedIn(req, res)) return;
  const collectionId = routeParam(req, "collectionId");
  const paperId = routeParam(req, "paperId");
  
  const [collection] = await db.select().from(collectionsTable).where(and(eq(collectionsTable.id, collectionId), eq(collectionsTable.userId, req.user.id))).limit(1);
  if (!collection) { res.status(404).json({ error: "Collection not found" }); return; }
  
  let [bookmark] = await db.select().from(bookmarksTable).where(and(eq(bookmarksTable.userId, req.user.id), eq(bookmarksTable.paperId, paperId))).limit(1);
  if (!bookmark) {
    const id = newId();
    await db.insert(bookmarksTable).values({ id, userId: req.user.id, paperId }).onConflictDoNothing();
    const [b] = await db.select().from(bookmarksTable).where(and(eq(bookmarksTable.userId, req.user.id), eq(bookmarksTable.paperId, paperId))).limit(1);
    bookmark = b;
  }
  
  if (bookmark) {
    await db.insert(collectionBookmarksTable).values({ id: newId(), collectionId, bookmarkId: bookmark.id }).onConflictDoNothing();
  }
  res.status(200).json({});
});

router.delete("/me/collections/:collectionId/papers/:paperId", async (req: Request, res: Response) => {
  if (!isSignedIn(req, res)) return;
  const collectionId = routeParam(req, "collectionId");
  const paperId = routeParam(req, "paperId");
  
  const [bookmark] = await db.select().from(bookmarksTable).where(and(eq(bookmarksTable.userId, req.user.id), eq(bookmarksTable.paperId, paperId))).limit(1);
  if (bookmark) {
    await db.delete(collectionBookmarksTable).where(and(eq(collectionBookmarksTable.collectionId, collectionId), eq(collectionBookmarksTable.bookmarkId, bookmark.id)));
  }
  res.status(200).json({});
});

// ── Feature 1: Author Profiles ──
router.get("/authors/:userId", async (req: Request, res: Response) => {
  const userId = routeParam(req, "userId");
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "Author not found" }); return; }

  const [profile] = await db.select().from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId)).limit(1);

  let departmentName: string | null = null;
  if (profile?.departmentId) {
    const [dept] = await db.select({ name: departmentsTable.name }).from(departmentsTable)
      .where(eq(departmentsTable.id, profile.departmentId)).limit(1);
    departmentName = dept?.name ?? null;
  }

  const rows = await loadPaperRows(and(eq(papersTable.uploadedById, userId), eq(papersTable.status, "APPROVED")));
  const papers = await Promise.all(rows.map(row => serializePaper(row as PaperWithNames)));
  const paperIds = papers.map(p => p.id);

  let totalViews = 0, totalDownloads = 0, totalBookmarks = 0;
  if (paperIds.length) {
    const views = await db.select({ count: sql<number>`cast(count(${paperActivityTable.id}) as integer)` })
      .from(paperActivityTable).where(and(eq(paperActivityTable.kind, "VIEW"), inArray(paperActivityTable.paperId, paperIds)));
    const downloads = await db.select({ count: sql<number>`cast(count(${paperActivityTable.id}) as integer)` })
      .from(paperActivityTable).where(and(eq(paperActivityTable.kind, "DOWNLOAD"), inArray(paperActivityTable.paperId, paperIds)));
    const bookmarkCount = await db.select({ count: sql<number>`cast(count(${bookmarksTable.id}) as integer)` })
      .from(bookmarksTable).where(inArray(bookmarksTable.paperId, paperIds));
    totalViews = views[0]?.count ?? 0;
    totalDownloads = downloads[0]?.count ?? 0;
    totalBookmarks = bookmarkCount[0]?.count ?? 0;
  }

  res.json({
    id: user.id,
    name: displayName(user.firstName, user.lastName, user.email),
    email: user.email,
    departmentName,
    role: profile?.role ?? "STUDENT",
    totalViews,
    totalDownloads,
    totalBookmarks,
    paperCount: papers.length,
    papers,
  });
});

// ── Feature 2: User Profile Management ──
router.patch("/me/profile", async (req: Request, res: Response) => {
  if (!isSignedIn(req, res)) return;
  const { firstName, lastName, departmentId } = req.body ?? {};
  if (firstName !== undefined || lastName !== undefined) {
    const updates: Record<string, unknown> = {};
    if (typeof firstName === "string") updates.firstName = firstName.trim();
    if (typeof lastName === "string") updates.lastName = lastName.trim();
    if (Object.keys(updates).length) {
      await db.update(usersTable).set(updates as any).where(eq(usersTable.id, req.user.id));
    }
  }
  if (departmentId !== undefined) {
    await db.update(userProfilesTable).set({ departmentId: departmentId || null })
      .where(eq(userProfilesTable.userId, req.user.id));
  }
  const profile = await getCurrentProfile(req);
  res.json(profile);
});

// ── Feature 3: Admin CSV Export ──
router.get("/admin/analytics/export", async (req: Request, res: Response) => {
  const profile = await requireRole(req, res, ["ADMIN"]);
  if (!profile) return;

  const rows = await db.select({
    id: papersTable.id,
    title: papersTable.title,
    year: papersTable.year,
    researchArea: papersTable.researchArea,
    paperType: papersTable.paperType,
    status: papersTable.status,
    departmentName: departmentsTable.name,
    authorFirstName: usersTable.firstName,
    authorLastName: usersTable.lastName,
    authorEmail: usersTable.email,
    createdAt: papersTable.createdAt,
  })
    .from(papersTable)
    .innerJoin(departmentsTable, eq(departmentsTable.id, papersTable.departmentId))
    .innerJoin(usersTable, eq(usersTable.id, papersTable.uploadedById))
    .orderBy(desc(papersTable.createdAt));

  const paperIds = rows.map(r => r.id);
  const viewMap = new Map<string, number>();
  const downloadMap = new Map<string, number>();
  const bookmarkMap = new Map<string, number>();

  if (paperIds.length) {
    const views = await db.select({ paperId: paperActivityTable.paperId, count: sql<number>`cast(count(${paperActivityTable.id}) as integer)` })
      .from(paperActivityTable).where(and(eq(paperActivityTable.kind, "VIEW"), inArray(paperActivityTable.paperId, paperIds))).groupBy(paperActivityTable.paperId);
    const downloads = await db.select({ paperId: paperActivityTable.paperId, count: sql<number>`cast(count(${paperActivityTable.id}) as integer)` })
      .from(paperActivityTable).where(and(eq(paperActivityTable.kind, "DOWNLOAD"), inArray(paperActivityTable.paperId, paperIds))).groupBy(paperActivityTable.paperId);
    const bookmarks = await db.select({ paperId: bookmarksTable.paperId, count: sql<number>`cast(count(${bookmarksTable.id}) as integer)` })
      .from(bookmarksTable).where(inArray(bookmarksTable.paperId, paperIds)).groupBy(bookmarksTable.paperId);
    views.forEach(v => viewMap.set(v.paperId, v.count));
    downloads.forEach(d => downloadMap.set(d.paperId, d.count));
    bookmarks.forEach(b => bookmarkMap.set(b.paperId, b.count));
  }

  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = "Title,Author,Department,Year,Research Area,Paper Type,Status,Views,Downloads,Bookmarks,Submitted";
  const csvRows = rows.map(r => [
    escape(r.title),
    escape(displayName(r.authorFirstName, r.authorLastName, r.authorEmail)),
    escape(r.departmentName),
    r.year,
    escape(r.researchArea),
    escape(r.paperType),
    r.status,
    viewMap.get(r.id) ?? 0,
    downloadMap.get(r.id) ?? 0,
    bookmarkMap.get(r.id) ?? 0,
    r.createdAt.toISOString().split("T")[0],
  ].join(","));

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="researchsphere-report-${new Date().toISOString().split("T")[0]}.csv"`);
  res.send([header, ...csvRows].join("\n"));
});

export default router;