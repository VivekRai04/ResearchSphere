import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Request } from "express";
import {
  db,
  departmentsTable,
  userProfilesTable,
  usersTable,
} from "@workspace/db";

export function newId(): string {
  return randomUUID();
}

export function displayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  email?: string | null,
): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  return email?.split("@")[0]?.replace(/[._-]+/g, " ") || "Researcher";
}

export async function ensureResearchProfile(user: Express.User) {
  const [existing] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, user.id))
    .limit(1);
  if (existing) return existing;

  const [firstProfile] = await db.select({ id: userProfilesTable.id })
    .from(userProfilesTable)
    .limit(1);
  const [created] = await db
    .insert(userProfilesTable)
    .values({
      id: newId(),
      userId: user.id,
      role: firstProfile ? "STUDENT" : "ADMIN",
    })
    .onConflictDoNothing({ target: userProfilesTable.userId })
    .returning();

  if (created) return created;
  const [racedProfile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, user.id))
    .limit(1);
  if (!racedProfile) throw new Error("Could not create user profile");
  return racedProfile;
}

export async function getCurrentProfile(req: Request) {
  if (!req.isAuthenticated()) return null;
  const profile = await ensureResearchProfile(req.user);
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id))
    .limit(1);

  if (!user) return null;
  let departmentName: string | null = null;
  if (profile.departmentId) {
    const [department] = await db
      .select({ name: departmentsTable.name })
      .from(departmentsTable)
      .where(eq(departmentsTable.id, profile.departmentId))
      .limit(1);
    departmentName = department?.name ?? null;
  }

  return {
    id: user.id,
    name: displayName(user.firstName, user.lastName, user.email),
    email: user.email,
    profileImageUrl: user.profileImageUrl,
    role: profile.role,
    departmentId: profile.departmentId,
    departmentName,
    isSuspended: user.isSuspended,
    suspensionReason: user.suspensionReason,
  };
}

export async function getProfileByUserId(userId: string) {
  const [result] = await db
    .select({
      role: userProfilesTable.role,
      departmentId: userProfilesTable.departmentId,
    })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId))
    .limit(1);
  return result ?? null;
}

export async function userCanAccessPaper(
  userId: string | undefined,
  paper: { status: string; uploadedById: string },
): Promise<boolean> {
  if (paper.status === "APPROVED") return true;
  if (!userId) return false;
  if (paper.uploadedById === userId) return true;
  const profile = await getProfileByUserId(userId);
  return profile?.role === "REVIEWER" || profile?.role === "ADMIN";
}

export async function userOwnsUpload(
  userId: string,
  objectPath: string,
): Promise<boolean> {
  const { uploadsTable } = await import("@workspace/db");
  const [upload] = await db
    .select({ id: uploadsTable.id })
    .from(uploadsTable)
    .where(
      and(
        eq(uploadsTable.userId, userId),
        eq(uploadsTable.objectPath, objectPath),
      ),
    )
    .limit(1);
  return Boolean(upload);
}

export function escapePdfText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function makeDemoPdf(title: string, abstract: string): Buffer {
  const cleanTitle = escapePdfText(title);
  const cleanAbstract = escapePdfText(abstract);
  const lines = cleanAbstract.match(/.{1,92}(?:\s|$)/g)?.slice(0, 13) ?? [];
  const textOps = [
    "BT",
    "/F1 16 Tf",
    "56 748 Td",
    `(${cleanTitle.slice(0, 100)}) Tj`,
    "/F1 10 Tf",
    "0 -34 Td",
    "(ResearchSphere demonstration paper) Tj",
    "0 -28 Td",
    "/F1 11 Tf",
    "(Abstract) Tj",
    "/F1 9 Tf",
    ...lines.flatMap((line) => [
      "0 -17 Td",
      `(${escapePdfText(line.trim())}) Tj`,
    ]),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(textOps, "ascii")} >>\nstream\n${textOps}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
}