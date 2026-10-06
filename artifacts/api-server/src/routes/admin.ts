import { randomUUID } from "node:crypto";
import { and, count, eq, sql } from "drizzle-orm";
import {
  AdminAnalytics,
  CreateCategoryBody,
  CreateCategoryResponse,
  CreateDepartmentBody,
  CreateDepartmentResponse,
  GetAdminAnalyticsResponse,
  CreateAdminUserBody,
  CreateAdminUserResponse,
  ListAdminUsersResponse,
  ListCategoriesResponse,
  ListDepartmentsResponse,
  UpdateCategoryBody,
  UpdateCategoryResponse,
  UpdateDepartmentBody,
  UpdateDepartmentResponse,
  UpdateUserRoleBody,
  UpdateUserRoleResponse,
} from "@workspace/api-zod";
import {
  categoriesTable,
  db,
  departmentsTable,
  papersTable,
  paperActivityTable,
  userProfilesTable,
  usersTable,
  paperCommentsTable,
} from "@workspace/db";
import { Router, type IRouter, type Request, type Response } from "express";
import fs from "fs/promises";
import path from "path";
import { displayName, ensureResearchProfile } from "../lib/researchsphere";

const router: IRouter = Router();

function routeParam(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

async function requireAdmin(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Sign-in is required" });
    return false;
  }
  const profile = await ensureResearchProfile(req.user);
  if (profile.role !== "ADMIN") {
    res.status(403).json({ error: "Administrator access is required" });
    return false;
  }
  return true;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

router.get("/departments", async (_req: Request, res: Response) => {
  const departments = await db.select().from(departmentsTable).orderBy(departmentsTable.name);
  res.json(ListDepartmentsResponse.parse(departments));
});

router.get("/admin/categories", async (req: Request, res: Response) => {
  const kind = req.query.kind;
  const categories = await db.select().from(categoriesTable)
    .where(kind === "RESEARCH_AREA" || kind === "PAPER_TYPE"
      ? eq(categoriesTable.kind, kind)
      : undefined)
    .orderBy(categoriesTable.kind, categoriesTable.name);
  res.json(ListCategoriesResponse.parse(categories));
});

router.get("/admin/analytics", async (req: Request, res: Response) => {
  if (!await requireAdmin(req, res)) return;
  const [
    [papers],
    [users],
    [departments],
    [events],
    byDepartment,
    byYear,
    byStatus,
    mostViewedPapers,
    mostDownloadedPapers,
  ] = await Promise.all([
    db.select({ value: count() }).from(papersTable),
    db.select({ value: count() }).from(userProfilesTable),
    db.select({ value: count() }).from(departmentsTable),
    db.select({ value: count() }).from(paperActivityTable),
    db.select({ label: departmentsTable.name, count: count() })
      .from(papersTable)
      .innerJoin(departmentsTable, eq(departmentsTable.id, papersTable.departmentId))
      .groupBy(departmentsTable.name)
      .orderBy(departmentsTable.name),
    db.select({ label: sql<string>`${papersTable.year}::text`, count: count() })
      .from(papersTable)
      .groupBy(papersTable.year)
      .orderBy(papersTable.year),
    db.select({ label: papersTable.status, count: count() })
      .from(papersTable)
      .groupBy(papersTable.status)
      .orderBy(papersTable.status),
    db.select({ id: papersTable.id, title: papersTable.title, count: sql<number>`count(*)::int` })
      .from(paperActivityTable)
      .innerJoin(papersTable, eq(papersTable.id, paperActivityTable.paperId))
      .where(eq(paperActivityTable.kind, 'VIEW'))
      .groupBy(papersTable.id, papersTable.title)
      .orderBy(sql`count(*) desc`)
      .limit(5),
    db.select({ id: papersTable.id, title: papersTable.title, count: sql<number>`count(*)::int` })
      .from(paperActivityTable)
      .innerJoin(papersTable, eq(papersTable.id, paperActivityTable.paperId))
      .where(eq(paperActivityTable.kind, 'DOWNLOAD'))
      .groupBy(papersTable.id, papersTable.title)
      .orderBy(sql`count(*) desc`)
      .limit(5),
  ]);
  res.json(GetAdminAnalyticsResponse.parse({
    totalPapers: papers.value,
    totalUsers: users.value,
    departmentsCount: departments.value,
    totalViewsDownloads: events.value,
    papersByDepartment: byDepartment,
    papersByYear: byYear,
    submissionsByStatus: byStatus,
    mostViewedPapers,
    mostDownloadedPapers,
  } satisfies AdminAnalytics));
});

router.post("/admin/departments", async (req: Request, res: Response) => {
  if (!await requireAdmin(req, res)) return;
  const parsed = CreateDepartmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide a department name and code" });
    return;
  }
  try {
    const [department] = await db.insert(departmentsTable).values({
      id: `${slug(parsed.data.name)}-${randomUUID().slice(0, 8)}`,
      name: parsed.data.name.trim(),
      code: parsed.data.code.trim().toUpperCase(),
    }).returning();
    res.status(201).json(CreateDepartmentResponse.parse(department));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "That department code is already in use" });
      return;
    }
    throw error;
  }
});

router.patch("/admin/departments/:departmentId", async (req: Request, res: Response) => {
  if (!await requireAdmin(req, res)) return;
  const parsed = UpdateDepartmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide a department name and code" });
    return;
  }
  try {
    const [department] = await db.update(departmentsTable).set({
      name: parsed.data.name.trim(),
      code: parsed.data.code.trim().toUpperCase(),
    }).where(eq(departmentsTable.id, routeParam(req, "departmentId"))).returning();
    if (!department) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    res.json(UpdateDepartmentResponse.parse(department));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "That department code is already in use" });
      return;
    }
    throw error;
  }
});

router.delete("/admin/departments/:departmentId", async (req: Request, res: Response) => {
  if (!await requireAdmin(req, res)) return;
  const id = routeParam(req, "departmentId");
  const [paper] = await db.select({ id: papersTable.id }).from(papersTable)
    .where(eq(papersTable.departmentId, id)).limit(1);
  const [profile] = await db.select({ id: userProfilesTable.id }).from(userProfilesTable)
    .where(eq(userProfilesTable.departmentId, id)).limit(1);
  if (paper || profile) {
    res.status(409).json({ error: "Move the papers and users out of this department first" });
    return;
  }
  const deleted = await db.delete(departmentsTable)
    .where(eq(departmentsTable.id, id)).returning({ id: departmentsTable.id });
  if (!deleted.length) {
    res.status(404).json({ error: "Department not found" });
    return;
  }
  res.status(204).end();
});

router.post("/admin/categories", async (req: Request, res: Response) => {
  if (!await requireAdmin(req, res)) return;
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a category type and name" });
    return;
  }
  try {
    const [category] = await db.insert(categoriesTable).values({
      id: `${parsed.data.kind.toLowerCase()}-${slug(parsed.data.name)}-${randomUUID().slice(0, 8)}`,
      kind: parsed.data.kind,
      name: parsed.data.name.trim(),
    }).returning();
    res.status(201).json(CreateCategoryResponse.parse(category));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "That category already exists" });
      return;
    }
    throw error;
  }
});

router.patch("/admin/categories/:categoryId", async (req: Request, res: Response) => {
  if (!await requireAdmin(req, res)) return;
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a category type and name" });
    return;
  }
  try {
    const [category] = await db.update(categoriesTable).set({
      kind: parsed.data.kind,
      name: parsed.data.name.trim(),
    }).where(eq(categoriesTable.id, routeParam(req, "categoryId"))).returning();
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.json(UpdateCategoryResponse.parse(category));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "That category already exists" });
      return;
    }
    throw error;
  }
});

router.delete("/admin/categories/:categoryId", async (req: Request, res: Response) => {
  if (!await requireAdmin(req, res)) return;
  const [category] = await db.select().from(categoriesTable)
    .where(eq(categoriesTable.id, routeParam(req, "categoryId"))).limit(1);
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  const referenceField = category.kind === "RESEARCH_AREA"
    ? papersTable.researchArea
    : papersTable.paperType;
  const [paper] = await db.select({ id: papersTable.id }).from(papersTable)
    .where(eq(referenceField, category.name)).limit(1);
  if (paper) {
    res.status(409).json({ error: "This category is used by a paper" });
    return;
  }
  await db.delete(categoriesTable).where(eq(categoriesTable.id, category.id));
  res.status(204).end();
});

router.get("/admin/users", async (req: Request, res: Response) => {
  if (!await requireAdmin(req, res)) return;
  const rows = await db.select({
    user: usersTable,
    profile: userProfilesTable,
    departmentName: departmentsTable.name,
  }).from(userProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, userProfilesTable.userId))
    .leftJoin(departmentsTable, eq(departmentsTable.id, userProfilesTable.departmentId))
    .orderBy(usersTable.createdAt);
  res.json(ListAdminUsersResponse.parse(rows.map(({ user, profile, departmentName }) => ({
    id: user.id,
    name: displayName(user.firstName, user.lastName, user.email),
    email: user.email,
    role: profile.role,
    departmentId: profile.departmentId,
    departmentName,
    isSuspended: user.isSuspended,
    suspensionReason: user.suspensionReason,
  }))));
});

router.patch("/admin/users/:userId/role", async (req: Request, res: Response) => {
  if (!await requireAdmin(req, res)) return;
  const parsed = UpdateUserRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a valid role" });
    return;
  }
  const targetId = routeParam(req, "userId");
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (parsed.data.departmentId) {
    const [department] = await db.select({ id: departmentsTable.id }).from(departmentsTable)
      .where(eq(departmentsTable.id, parsed.data.departmentId)).limit(1);
    if (!department) {
      res.status(400).json({ error: "Choose an existing department" });
      return;
    }
  }
  const [current] = await db.select().from(userProfilesTable)
    .where(eq(userProfilesTable.userId, targetId)).limit(1);
  if (current?.role === "ADMIN" && parsed.data.role !== "ADMIN") {
    const [adminCount] = await db.select({ value: count() }).from(userProfilesTable)
      .where(eq(userProfilesTable.role, "ADMIN"));
    if (adminCount.value <= 1) {
      res.status(409).json({ error: "At least one administrator must remain" });
      return;
    }
  }
  if (current) {
    await db.update(userProfilesTable).set({
      role: parsed.data.role,
      departmentId: parsed.data.departmentId ?? null,
    }).where(eq(userProfilesTable.userId, targetId));
  } else {
    await db.insert(userProfilesTable).values({
      id: randomUUID(),
      userId: targetId,
      role: parsed.data.role,
      departmentId: parsed.data.departmentId ?? null,
    });
  }
  const [updated] = await db.select({
    profile: userProfilesTable,
    departmentName: departmentsTable.name,
  }).from(userProfilesTable)
    .leftJoin(departmentsTable, eq(departmentsTable.id, userProfilesTable.departmentId))
    .where(eq(userProfilesTable.userId, targetId)).limit(1);
  res.json(UpdateUserRoleResponse.parse({
    id: user.id,
    name: displayName(user.firstName, user.lastName, user.email),
    email: user.email,
    role: updated.profile.role,
    departmentId: updated.profile.departmentId,
    departmentName: updated.departmentName,
  }));
});


router.post("/admin/users", async (req: Request, res: Response) => {
  if (!await requireAdmin(req, res)) return;
  const parsed = CreateAdminUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide a valid email, password, name, and role" });
    return;
  }
  
  const existing = await db.query.usersTable.findFirst({
    where: (users, { eq }) => eq(users.email, parsed.data.email)
  });
  if (existing) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  if (parsed.data.departmentId) {
    const [department] = await db.select({ id: departmentsTable.id }).from(departmentsTable)
      .where(eq(departmentsTable.id, parsed.data.departmentId)).limit(1);
    if (!department) {
      res.status(400).json({ error: "Choose an existing department" });
      return;
    }
  }

  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const [user] = await db.insert(usersTable).values({
    email: parsed.data.email,
    passwordHash,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName
  }).returning();

  const [profile] = await db.insert(userProfilesTable).values({
    id: randomUUID(),
    userId: user.id,
    role: parsed.data.role,
    departmentId: parsed.data.departmentId || null
  }).returning();

  let departmentName = null;
  if (profile.departmentId) {
    const [dep] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, profile.departmentId)).limit(1);
    if (dep) departmentName = dep.name;
  }

  res.status(201).json(CreateAdminUserResponse.parse({
    id: user.id,
    name: displayName(user.firstName, user.lastName, user.email),
    email: user.email,
    role: profile.role,
    departmentId: profile.departmentId,
    departmentName,
  }));
});

router.post("/admin/papers/:paperId/remove", async (req: Request, res: Response) => {
  if (!await requireAdmin(req, res)) return;
  const paperId = routeParam(req, "paperId");
  const { reason } = req.body || {};

  try {
    const [paper] = await db.select({ objectPath: papersTable.objectPath }).from(papersTable).where(eq(papersTable.id, paperId));
    
    if (!paper) {
      res.status(404).json({ error: "Paper not found" });
      return;
    }

    await db.update(papersTable).set({ 
      status: "REJECTED", 
      rejectionReason: reason || "Removed by administrator"
    }).where(eq(papersTable.id, paperId));

    if (paper.objectPath) {
      try {
        await fs.unlink(path.resolve(process.cwd(), 'uploads', paper.objectPath));
        // Remove the object path so it doesn't try to serve a deleted file
        await db.update(papersTable).set({ objectPath: null }).where(eq(papersTable.id, paperId));
      } catch (e) {
        console.error("Failed to delete file from disk:", e);
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to remove paper" });
  }
});

router.delete("/admin/papers/:paperId/comments/:commentId", async (req: Request, res: Response) => {
  if (!await requireAdmin(req, res)) return;
  const commentId = routeParam(req, "commentId");
  
  try {
    const deleted = await db.delete(paperCommentsTable).where(eq(paperCommentsTable.id, commentId)).returning();
    if (!deleted.length) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

router.post("/admin/users/:userId/suspend", async (req: Request, res: Response) => {
  if (!await requireAdmin(req, res)) return;
  const userId = routeParam(req, "userId");
  const reason = req.body?.reason || null;

  try {
    const targetProfile = await db.query.userProfilesTable.findFirst({
      where: (profiles, { eq }) => eq(profiles.userId, userId)
    });
    if (targetProfile?.role === 'ADMIN') {
      res.status(403).json({ error: "Administrators cannot be suspended" });
      return;
    }

    const [user] = await db.update(usersTable).set({ isSuspended: true, suspensionReason: reason }).where(eq(usersTable.id, userId)).returning();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ success: true, isSuspended: user.isSuspended, suspensionReason: user.suspensionReason });
  } catch (error) {
    res.status(500).json({ error: "Failed to suspend user" });
  }
});

router.post("/admin/users/:userId/unsuspend", async (req: Request, res: Response) => {
  if (!await requireAdmin(req, res)) return;
  const userId = routeParam(req, "userId");

  try {
    const [user] = await db.update(usersTable).set({ isSuspended: false, suspensionReason: null }).where(eq(usersTable.id, userId)).returning();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ success: true, isSuspended: user.isSuspended, suspensionReason: user.suspensionReason });
  } catch (error) {
    res.status(500).json({ error: "Failed to unsuspend user" });
  }
});

export default router;