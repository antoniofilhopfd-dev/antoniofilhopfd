import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { prisma } from "../prisma";
import { hashPassword } from "../auth/password";
import { createObservation, deleteObservation, listObservations } from "./service";

beforeEach(async () => {
  await prisma.weeklyObservation.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.weeklyObservation.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

async function createUser(role: UserRole) {
  return prisma.user.create({
    data: {
      name: role === UserRole.ADMIN ? "Admin" : "Gestor",
      email: `${role.toLowerCase()}-${Date.now()}-${Math.random()}@evolucao.test`,
      passwordHash: await hashPassword("senha-valida-123"),
      role,
    },
  });
}

describe("createObservation / listObservations", () => {
  it("registra a observação com autoria e a normaliza para o início da semana", async () => {
    const manager = await createUser(UserRole.MANAGER);
    // Quarta-feira: deve normalizar para o domingo da mesma semana.
    const observation = await createObservation(new Date("2026-01-07T00:00:00.000Z"), "Boa semana de conversas.", manager.id);

    expect(observation.authorId).toBe(manager.id);

    const list = await listObservations(new Date("2026-01-05T00:00:00.000Z"));
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(observation.id);
    expect(list[0].author.name).toBe("Gestor");
  });
});

describe("deleteObservation", () => {
  it("permite que o próprio autor remova a observação", async () => {
    const manager = await createUser(UserRole.MANAGER);
    const observation = await createObservation(new Date("2026-01-05T00:00:00.000Z"), "Nota", manager.id);

    const result = await deleteObservation(observation.id, { id: manager.id, role: "MANAGER" });
    expect(result).not.toBe("forbidden");
    expect(result).not.toBeNull();

    const list = await listObservations(new Date("2026-01-05T00:00:00.000Z"));
    expect(list).toHaveLength(0);
  });

  it("permite que um administrador remova a observação de outro usuário", async () => {
    const manager = await createUser(UserRole.MANAGER);
    const admin = await createUser(UserRole.ADMIN);
    const observation = await createObservation(new Date("2026-01-05T00:00:00.000Z"), "Nota", manager.id);

    const result = await deleteObservation(observation.id, { id: admin.id, role: "ADMIN" });
    expect(result).not.toBe("forbidden");
  });

  it("recusa remoção por outro usuário que não seja autor nem administrador", async () => {
    const manager = await createUser(UserRole.MANAGER);
    const otherManager = await createUser(UserRole.MANAGER);
    const observation = await createObservation(new Date("2026-01-05T00:00:00.000Z"), "Nota", manager.id);

    const result = await deleteObservation(observation.id, { id: otherManager.id, role: "MANAGER" });
    expect(result).toBe("forbidden");

    const list = await listObservations(new Date("2026-01-05T00:00:00.000Z"));
    expect(list).toHaveLength(1);
  });
});
