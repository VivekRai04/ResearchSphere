import { Readable } from 'stream';
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from '@workspace/api-zod';
import { Router, type IRouter, type Request, type Response } from 'express';
import { and, eq, or } from 'drizzle-orm';
import {
  db,
  paperVersionsTable,
  papersTable,
  uploadsTable,
} from '@workspace/db';

import {
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';
import { newId, userCanAccessPaper } from '../lib/researchsphere';
import fs from 'fs/promises';
import path from 'path';
import express from 'express';

const router: IRouter = Router();
// const objectStorageService = new ObjectStorageService(); // Not needed anymore


function hasAuthenticatedSession(
  req: Request,
): req is Request & { isAuthenticated: () => boolean; user: Express.User } {
  if (
    !('isAuthenticated' in req) ||
    typeof req.isAuthenticated !== 'function'
  ) {
    return false;
  }

  return req.isAuthenticated();
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 * Requires auth middleware so public callers cannot mint write-capable URLs.
 */
router.post(
  '/storage/uploads/request-url',
  async (req: Request, res: Response) => {
    if (!hasAuthenticatedSession(req)) {
      res.status(401).json({ error: 'Unauthorized' });

      return;
    }

    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;
      if (contentType !== 'application/pdf' || size > 25 * 1024 * 1024) {
        res.status(400).json({ error: 'Upload a PDF no larger than 25 MB' });
        return;
      }

      const objectId = newId();
      const objectPath = `${objectId}.pdf`;
      const origin = req.get('origin') || 'http://localhost:3000';
      const uploadURL = `${origin}/api/storage/upload-direct/${objectId}`;

      await db.insert(uploadsTable).values({
        id: objectId,
        userId: req.user.id,
        objectPath,
        fileName: name,
        size,
        contentType,
      });

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, 'Error generating upload URL');
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  },
);

router.put(
  '/storage/upload-direct/:objectId',
  express.raw({ limit: '25mb', type: 'application/pdf' }),
  async (req, res) => {
    try {
      const objectId = req.params.objectId;
      const uploadDir = path.resolve(process.cwd(), 'uploads');
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(path.join(uploadDir, `${objectId}.pdf`), req.body);
      res.status(200).send('OK');
    } catch (error) {
      req.log.error({ err: error }, 'Error saving upload file');
      res.status(500).send('Internal Server Error');
    }
  }
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join('/') : raw;
      
      const publicDirsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || '';
      const publicDirs = publicDirsStr.split(',').map(d => d.trim()).filter(Boolean);
      
      let foundPath = null;
      for (const dir of publicDirs) {
        const fullPath = path.resolve(process.cwd(), dir, filePath);
        try {
          await fs.access(fullPath);
          foundPath = fullPath;
          break;
        } catch {}
      }

      if (!foundPath) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      
      res.sendFile(foundPath);
    } catch (error) {
      req.log.error({ err: error }, 'Error serving public object');
      res.status(500).json({ error: 'Failed to serve public object' });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get('/storage/objects/*path', async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    // Our local system uses the raw name without /objects/ prefix since we removed it
    const objectPath = wildcardPath.replace(/^\/?objects\//, '');
    const dbObjectPathSearch = wildcardPath; // keep what the DB has, which might be `/objects/1234.pdf` if it was from earlier. Actually wait, let's search with `wildcardPath` or `/objects/${wildcardPath}`.

    const searchPath = `/objects/${wildcardPath}`;

    const [paper] = await db.select().from(papersTable)
      .where(or(eq(papersTable.objectPath, searchPath), eq(papersTable.objectPath, objectPath))).limit(1);
    const [version] = paper ? [] : await db.select({ paper: papersTable })
      .from(paperVersionsTable)
      .innerJoin(papersTable, eq(papersTable.id, paperVersionsTable.paperId))
      .where(or(eq(paperVersionsTable.objectPath, searchPath), eq(paperVersionsTable.objectPath, objectPath)))
      .limit(1);
    const [upload] = paper || version ? [] : await db.select({
      userId: uploadsTable.userId,
    }).from(uploadsTable).where(or(eq(uploadsTable.objectPath, searchPath), eq(uploadsTable.objectPath, objectPath))).limit(1);
    
    const protectedPaper = paper ?? version?.paper;
    const finalUpload = upload;

    const canAccess = protectedPaper
      ? await userCanAccessPaper(
          req.isAuthenticated() ? req.user.id : undefined,
          protectedPaper,
        )
      : Boolean(finalUpload && req.isAuthenticated() && finalUpload.userId === req.user.id);
      
    if (!canAccess) {
      res.status(req.isAuthenticated() ? 403 : 401).json({ error: 'Forbidden' });
      return;
    }

    // New format (e.g., 1234.pdf) or old format (e.g., /objects/1234.pdf which is stored as 1234.pdf)
    const fileName = objectPath; 
    const fullPath = path.resolve(process.cwd(), 'uploads', fileName);
    
    try {
      await fs.access(fullPath);
    } catch (e) {
      req.log.warn({ err: e }, 'Object not found locally');
      res.status(404).json({ error: 'Object not found' });
      return;
    }

    res.sendFile(fullPath);
  } catch (error) {
    req.log.error({ err: error }, 'Error serving object');
    res.status(500).json({ error: 'Failed to serve object' });
  }
});

export default router;
