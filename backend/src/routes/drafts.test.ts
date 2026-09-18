import fs from "node:fs/promises";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { createApp } from "../app";
import { prisma } from "../prisma";
import { hashPassword } from "../auth/password";
import { UPLOAD_DIR } from "../drafts/service";

const app = createApp();

async function createUserAndLogin(role: UserRole) {
  const password = "senha-valida-123";
  const user = await prisma.user.create({
    data: {
      name: role,
      email: `${role.toLowerCase()}-${Date.now()}-${Math.random()}@evolucao.test`,
      passwordHash: await hashPassword(password),
      role,
    },
  });

  const loginResponse = await request(app).post("/auth/login").send({ email: user.email, password });
  const cookie = loginResponse.headers["set-cookie"];
  return { user, cookie };
}

beforeEach(async () => {
  await prisma.draft.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.draft.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
  await fs.rm(UPLOAD_DIR, { recursive: true, force: true });
});

describe("CRUD de rascunhos", () => {
  it("permite que um Gestor crie, edite e recarregue um rascunho", async () => {
    const { cookie } = await createUserAndLogin(UserRole.MANAGER);

    const createResponse = await request(app).post("/drafts").set("Cookie", cookie);
    expect(createResponse.status).toBe(201);
    const draftId = createResponse.body.id;

    const patchResponse = await request(app)
      .patch(`/drafts/${draftId}`)
      .set("Cookie", cookie)
      .send({ campaignName: "Matrículas 2027", dailyBudget: 80, ageMin: 25, ageMax: 45 });
    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.campaignName).toBe("Matrículas 2027");
    expect(patchResponse.body.dailyBudget).toBe(80);

    const reloadResponse = await request(app).get(`/drafts/${draftId}`).set("Cookie", cookie);
    expect(reloadResponse.status).toBe(200);
    expect(reloadResponse.body.campaignName).toBe("Matrículas 2027");
    expect(reloadResponse.body.ageMin).toBe(25);
  });

  it("rejeita criação/edição por Visualizador", async () => {
    const { cookie } = await createUserAndLogin(UserRole.VIEWER);
    const response = await request(app).post("/drafts").set("Cookie", cookie);
    expect(response.status).toBe(403);
  });

  it("impede que um Gestor edite o rascunho de outro Gestor", async () => {
    const { cookie: cookieA } = await createUserAndLogin(UserRole.MANAGER);
    const { cookie: cookieB } = await createUserAndLogin(UserRole.MANAGER);

    const createResponse = await request(app).post("/drafts").set("Cookie", cookieA);
    const draftId = createResponse.body.id;

    const response = await request(app)
      .patch(`/drafts/${draftId}`)
      .set("Cookie", cookieB)
      .send({ campaignName: "Tentativa indevida" });
    expect(response.status).toBe(403);
  });

  it("permite que um Administrador acesse rascunhos de qualquer Gestor", async () => {
    const { cookie: managerCookie } = await createUserAndLogin(UserRole.MANAGER);
    const { cookie: adminCookie } = await createUserAndLogin(UserRole.ADMIN);

    const createResponse = await request(app).post("/drafts").set("Cookie", managerCookie);
    const draftId = createResponse.body.id;

    const response = await request(app).get(`/drafts/${draftId}`).set("Cookie", adminCookie);
    expect(response.status).toBe(200);
  });

  it("retorna erros por campo na validação de um rascunho incompleto", async () => {
    const { cookie } = await createUserAndLogin(UserRole.MANAGER);
    const createResponse = await request(app).post("/drafts").set("Cookie", cookie);
    const draftId = createResponse.body.id;

    const response = await request(app).get(`/drafts/${draftId}/validation`).set("Cookie", cookie);
    expect(response.status).toBe(200);
    expect(response.body.complete).toBe(false);
    expect(response.body.fieldErrors.campaignName).toBeDefined();
    expect(response.body.fieldErrors.image).toBeDefined();
  });
});

describe("upload de imagem", () => {
  it("faz upload de uma imagem PNG válida e permite removê-la depois", async () => {
    const { cookie } = await createUserAndLogin(UserRole.MANAGER);
    const createResponse = await request(app).post("/drafts").set("Cookie", cookie);
    const draftId = createResponse.body.id;

    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    );

    const uploadResponse = await request(app)
      .post(`/drafts/${draftId}/image`)
      .set("Cookie", cookie)
      .attach("image", pngBuffer, { filename: "teste.png", contentType: "image/png" });

    expect(uploadResponse.status).toBe(200);
    expect(uploadResponse.body.hasImage).toBe(true);

    const imageResponse = await request(app).get(`/drafts/${draftId}/image`).set("Cookie", cookie);
    expect(imageResponse.status).toBe(200);

    const deleteResponse = await request(app).delete(`/drafts/${draftId}/image`).set("Cookie", cookie);
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.hasImage).toBe(false);
  });

  it("rejeita upload de arquivo que não seja PNG/JPEG", async () => {
    const { cookie } = await createUserAndLogin(UserRole.MANAGER);
    const createResponse = await request(app).post("/drafts").set("Cookie", cookie);
    const draftId = createResponse.body.id;

    const response = await request(app)
      .post(`/drafts/${draftId}/image`)
      .set("Cookie", cookie)
      .attach("image", Buffer.from("não é uma imagem"), { filename: "arquivo.txt", contentType: "text/plain" });

    expect(response.status).toBe(400);
  });
});

describe("exclusão de rascunho", () => {
  it("remove o rascunho e sua imagem do disco", async () => {
    const { cookie } = await createUserAndLogin(UserRole.MANAGER);
    const createResponse = await request(app).post("/drafts").set("Cookie", cookie);
    const draftId = createResponse.body.id;

    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    );
    await request(app)
      .post(`/drafts/${draftId}/image`)
      .set("Cookie", cookie)
      .attach("image", pngBuffer, { filename: "teste.png", contentType: "image/png" });

    const deleteResponse = await request(app).delete(`/drafts/${draftId}`).set("Cookie", cookie);
    expect(deleteResponse.status).toBe(204);

    const getResponse = await request(app).get(`/drafts/${draftId}`).set("Cookie", cookie);
    expect(getResponse.status).toBe(404);
  });
});
