import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { createApp } from "../app";
import { prisma } from "../prisma";
import { hashPassword } from "../auth/password";

const app = createApp();

async function createUser(overrides: Partial<{
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
}> = {}) {
  const password = overrides.password ?? "senha-valida-123";
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name: "Usuário Teste",
      email: overrides.email ?? `teste-${Date.now()}-${Math.random()}@evolucao.test`,
      passwordHash,
      role: overrides.role ?? UserRole.VIEWER,
      isActive: overrides.isActive ?? true,
    },
  });

  return { user, password };
}

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

describe("POST /auth/login", () => {
  it("autentica com credenciais válidas e define cookie de sessão", async () => {
    const { user, password } = await createUser();

    const response = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password });

    expect(response.status).toBe(200);
    expect(response.body.email).toBe(user.email);
    expect(response.headers["set-cookie"]).toBeDefined();
  });

  it("rejeita senha incorreta", async () => {
    const { user } = await createUser();

    const response = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password: "senha-errada" });

    expect(response.status).toBe(401);
  });

  it("rejeita usuário inativo mesmo com senha correta", async () => {
    const { user, password } = await createUser({ isActive: false });

    const response = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password });

    expect(response.status).toBe(403);
  });

  it("bloqueia a conta após muitas tentativas com senha errada", async () => {
    const { user } = await createUser();

    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post("/auth/login")
        .send({ email: user.email, password: "senha-errada" });
    }

    const response = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password: "senha-errada" });

    expect(response.status).toBe(423);
  });
});

describe("Rotas protegidas", () => {
  it("rejeita acesso a /auth/me sem sessão", async () => {
    const response = await request(app).get("/auth/me");
    expect(response.status).toBe(401);
  });

  it("permite acesso a /auth/me com sessão válida", async () => {
    const { user, password } = await createUser();

    const loginResponse = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password });

    const cookie = loginResponse.headers["set-cookie"];

    const meResponse = await request(app).get("/auth/me").set("Cookie", cookie);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.email).toBe(user.email);
  });

  it("rejeita sessão revogada após logout", async () => {
    const { user, password } = await createUser();

    const loginResponse = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password });

    const cookie = loginResponse.headers["set-cookie"];

    await request(app).post("/auth/logout").set("Cookie", cookie);

    const meResponse = await request(app).get("/auth/me").set("Cookie", cookie);

    expect(meResponse.status).toBe(401);
  });

  it("rejeita GET /users para perfil sem permissão (VIEWER)", async () => {
    const { user, password } = await createUser({ role: UserRole.VIEWER });

    const loginResponse = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password });

    const cookie = loginResponse.headers["set-cookie"];

    const usersResponse = await request(app).get("/users").set("Cookie", cookie);

    expect(usersResponse.status).toBe(403);
  });

  it("permite GET /users para ADMIN", async () => {
    const { user, password } = await createUser({ role: UserRole.ADMIN });

    const loginResponse = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password });

    const cookie = loginResponse.headers["set-cookie"];

    const usersResponse = await request(app).get("/users").set("Cookie", cookie);

    expect(usersResponse.status).toBe(200);
    expect(Array.isArray(usersResponse.body)).toBe(true);
  });

  it("rejeita requisição direta a /users com cookie forjado inexistente", async () => {
    const response = await request(app)
      .get("/users")
      .set("Cookie", ["evolucao_session=token-forjado-inexistente"]);

    expect(response.status).toBe(401);
  });
});
