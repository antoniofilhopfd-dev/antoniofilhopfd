import crypto from "node:crypto";
import type { Request } from "express";
import { prisma } from "../prisma";

export const SESSION_COOKIE_NAME = "evolucao_session";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 horas

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
  req: Pick<Request, "headers" | "ip">
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    },
  });

  return { token, expiresAt };
}

export async function getUserBySessionToken(token: string) {
  const tokenHash = hashToken(token);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  if (!session.user.isActive) return null;

  return { session, user: session.user };
}

export async function revokeSessionByToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
