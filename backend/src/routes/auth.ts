import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../prisma";
import { verifyPassword } from "../auth/password";
import {
  SESSION_COOKIE_NAME,
  createSession,
  revokeSessionByToken,
} from "../auth/session";
import { requireAuth } from "../auth/middleware";

export const authRouter = Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Tente novamente mais tarde." },
});

authRouter.post("/auth/login", loginRateLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user) {
    return res.status(401).json({ error: "Credenciais inválidas." });
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return res.status(423).json({
      error: "Conta temporariamente bloqueada por excesso de tentativas. Tente novamente mais tarde.",
    });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: "Usuário inativo." });
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  if (!passwordMatches) {
    const failedLoginCount = user.failedLoginCount + 1;
    const shouldLock = failedLoginCount >= MAX_FAILED_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: shouldLock ? 0 : failedLoginCount,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
      },
    });

    return res.status(401).json({ error: "Credenciais inválidas." });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  });

  const { token, expiresAt } = await createSession(user.id, req);

  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    canSubmitToMeta: user.canSubmitToMeta,
  });
});

authRouter.post("/auth/logout", requireAuth, async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];

  if (token) {
    await revokeSessionByToken(token);
  }

  res.clearCookie(SESSION_COOKIE_NAME);
  res.status(204).send();
});

authRouter.get("/auth/me", requireAuth, (req, res) => {
  const user = req.currentUser!;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    canSubmitToMeta: user.canSubmitToMeta,
  });
});
