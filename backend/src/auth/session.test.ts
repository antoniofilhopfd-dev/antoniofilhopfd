import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { prisma } from "../prisma";
import { hashPassword } from "./password";
import { createSession, getUserBySessionToken, revokeSessionByToken } from "./session";

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

async function createUser() {
  return prisma.user.create({
    data: {
      name: "Usuário Sessão",
      email: `sessao-${Date.now()}-${Math.random()}@evolucao.test`,
      passwordHash: await hashPassword("senha-valida-123"),
      role: UserRole.VIEWER,
    },
  });
}

describe("sessões", () => {
  it("retorna null para sessão expirada", async () => {
    const user = await createUser();
    const { token } = await createSession(user.id, { headers: {}, ip: "127.0.0.1" });

    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await getUserBySessionToken(token);
    expect(result).toBeNull();
  });

  it("retorna null para sessão revogada", async () => {
    const user = await createUser();
    const { token } = await createSession(user.id, { headers: {}, ip: "127.0.0.1" });

    await revokeSessionByToken(token);

    const result = await getUserBySessionToken(token);
    expect(result).toBeNull();
  });

  it("retorna o usuário para sessão válida", async () => {
    const user = await createUser();
    const { token } = await createSession(user.id, { headers: {}, ip: "127.0.0.1" });

    const result = await getUserBySessionToken(token);
    expect(result?.user.id).toBe(user.id);
  });
});
