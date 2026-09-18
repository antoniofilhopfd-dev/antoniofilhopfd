import { Router } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../prisma";
import { hashPassword } from "../auth/password";
import { requireAuth, requireRole } from "../auth/middleware";
import { revokeAllSessionsForUser } from "../auth/session";

export const usersRouter = Router();

usersRouter.use(requireAuth);

function serializeUser(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  canSubmitToMeta: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    canSubmitToMeta: user.canSubmitToMeta,
    createdAt: user.createdAt,
  };
}

usersRouter.get("/users", requireRole(UserRole.ADMIN), async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  res.json(users.map(serializeUser));
});

usersRouter.post("/users", requireRole(UserRole.ADMIN), async (req, res) => {
  const { name, email, password, role } = req.body ?? {};

  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    !Object.values(UserRole).includes(role)
  ) {
    return res.status(400).json({ error: "Dados de usuário inválidos." });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Senha deve ter ao menos 8 caracteres." });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return res.status(409).json({ error: "Já existe um usuário com este e-mail." });
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
      createdById: req.currentUser!.id,
    },
  });

  res.status(201).json(serializeUser(user));
});

usersRouter.patch("/users/:id", requireRole(UserRole.ADMIN), async (req, res) => {
  const { id } = req.params;
  const { name, role, isActive, canSubmitToMeta, password } = req.body ?? {};

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return res.status(404).json({ error: "Usuário não encontrado." });
  }

  const data: Record<string, unknown> = {};

  if (typeof name === "string") data.name = name;
  if (role !== undefined) {
    if (!Object.values(UserRole).includes(role)) {
      return res.status(400).json({ error: "Perfil inválido." });
    }
    data.role = role;
  }
  if (typeof isActive === "boolean") data.isActive = isActive;
  if (typeof canSubmitToMeta === "boolean") data.canSubmitToMeta = canSubmitToMeta;
  if (typeof password === "string") {
    if (password.length < 8) {
      return res.status(400).json({ error: "Senha deve ter ao menos 8 caracteres." });
    }
    data.passwordHash = await hashPassword(password);
  }

  const updated = await prisma.user.update({ where: { id }, data });

  if (isActive === false || password !== undefined || role !== undefined) {
    await revokeAllSessionsForUser(id);
  }

  res.json(serializeUser(updated));
});
