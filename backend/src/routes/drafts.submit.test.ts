import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { CallToAction, DraftSubmissionStatus, UserRole } from "@prisma/client";
import { createApp } from "../app";
import { prisma } from "../prisma";
import { hashPassword } from "../auth/password";

const app = createApp();

async function createUserAndLogin(role: UserRole, canSubmitToMeta = false) {
  const password = "senha-valida-123";
  const user = await prisma.user.create({
    data: {
      name: role,
      email: `${role.toLowerCase()}-${Date.now()}-${Math.random()}@evolucao.test`,
      passwordHash: await hashPassword(password),
      role,
      canSubmitToMeta,
    },
  });

  const loginResponse = await request(app).post("/auth/login").send({ email: user.email, password });
  const cookie = loginResponse.headers["set-cookie"];
  return { user, cookie };
}

async function createCompleteDraft(createdById: string) {
  return prisma.draft.create({
    data: {
      createdById,
      campaignName: "Campanha",
      adSetName: "Conjunto",
      dailyBudget: "50",
      country: "BR",
      ageMin: 20,
      ageMax: 45,
      adName: "Anúncio",
      facebookPageName: "1234567890",
      title: "Matricule-se já",
      bodyText: "Texto do anúncio dentro do limite.",
      destinationUrl: "https://exemplo.com.br/matriculas",
      callToAction: CallToAction.SAIBA_MAIS,
      imageFilename: "abc.png",
      imageOriginalName: "foto.png",
      imageMimeType: "image/png",
      imageSize: 1000,
    },
  });
}

beforeEach(async () => {
  await prisma.draft.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  delete process.env.META_ACCESS_TOKEN;
  delete process.env.META_AD_ACCOUNT_ID;
});

afterEach(async () => {
  delete process.env.META_ACCESS_TOKEN;
  delete process.env.META_AD_ACCOUNT_ID;
});

afterAll(async () => {
  await prisma.draft.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

describe("POST /drafts/:id/submit", () => {
  it("retorna 409 quando a integração Meta não está configurada", async () => {
    const { user, cookie } = await createUserAndLogin(UserRole.ADMIN);
    const draft = await createCompleteDraft(user.id);

    const response = await request(app)
      .post(`/drafts/${draft.id}/submit`)
      .set("Cookie", cookie)
      .send({ confirmAccount: true, confirmAudience: true, confirmBudget: true, confirmCreative: true });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("not_configured");
  });

  it("retorna 403 para Gestor sem permissão individual", async () => {
    process.env.META_ACCESS_TOKEN = "fake-token";
    process.env.META_AD_ACCOUNT_ID = "123";
    const { user, cookie } = await createUserAndLogin(UserRole.MANAGER, false);
    const draft = await createCompleteDraft(user.id);

    const response = await request(app)
      .post(`/drafts/${draft.id}/submit`)
      .set("Cookie", cookie)
      .send({ confirmAccount: true, confirmAudience: true, confirmBudget: true, confirmCreative: true });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("no_permission");
  });

  it("retorna 400 quando faltam confirmações explícitas", async () => {
    process.env.META_ACCESS_TOKEN = "fake-token";
    process.env.META_AD_ACCOUNT_ID = "123";
    const { user, cookie } = await createUserAndLogin(UserRole.ADMIN);
    const draft = await createCompleteDraft(user.id);

    const response = await request(app)
      .post(`/drafts/${draft.id}/submit`)
      .set("Cookie", cookie)
      .send({ confirmAccount: true, confirmAudience: true, confirmBudget: false, confirmCreative: true });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("confirmation_required");
  });

  it("retorna 400 quando o rascunho está incompleto", async () => {
    process.env.META_ACCESS_TOKEN = "fake-token";
    process.env.META_AD_ACCOUNT_ID = "123";
    const { user, cookie } = await createUserAndLogin(UserRole.ADMIN);
    const draft = await prisma.draft.create({ data: { createdById: user.id } });

    const response = await request(app)
      .post(`/drafts/${draft.id}/submit`)
      .set("Cookie", cookie)
      .send({ confirmAccount: true, confirmAudience: true, confirmBudget: true, confirmCreative: true });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("incomplete");
    expect(response.body.fieldErrors).toBeDefined();
  });

  it("rejeita Visualizador (VIEWER) totalmente", async () => {
    process.env.META_ACCESS_TOKEN = "fake-token";
    process.env.META_AD_ACCOUNT_ID = "123";
    const admin = await createUserAndLogin(UserRole.ADMIN);
    const draft = await createCompleteDraft(admin.user.id);
    const { cookie } = await createUserAndLogin(UserRole.VIEWER);

    const response = await request(app)
      .post(`/drafts/${draft.id}/submit`)
      .set("Cookie", cookie)
      .send({ confirmAccount: true, confirmAudience: true, confirmBudget: true, confirmCreative: true });

    expect(response.status).toBe(403);
  });
});

describe("POST /drafts/:id/submit/resolve", () => {
  it("é restrito a ADMIN", async () => {
    const { user, cookie: managerCookie } = await createUserAndLogin(UserRole.MANAGER, true);
    const draft = await createCompleteDraft(user.id);
    await prisma.draft.update({
      where: { id: draft.id },
      data: { submissionStatus: DraftSubmissionStatus.AMBIGUOUS_BLOCKED },
    });

    const response = await request(app)
      .post(`/drafts/${draft.id}/submit/resolve`)
      .set("Cookie", managerCookie)
      .send({ action: "retry" });

    expect(response.status).toBe(403);
  });

  it("libera rascunho bloqueado por ambiguidade quando ADMIN confirma que a etapa não foi criada", async () => {
    const { user, cookie } = await createUserAndLogin(UserRole.ADMIN);
    const draft = await createCompleteDraft(user.id);
    await prisma.draft.update({
      where: { id: draft.id },
      data: { submissionStatus: DraftSubmissionStatus.AMBIGUOUS_BLOCKED, lastSubmissionError: "indeterminado" },
    });

    const response = await request(app)
      .post(`/drafts/${draft.id}/submit/resolve`)
      .set("Cookie", cookie)
      .send({ action: "retry" });

    expect(response.status).toBe(200);
    expect(response.body.submissionStatus).toBe(DraftSubmissionStatus.FAILED);
  });

  it("rejeita ação inválida", async () => {
    const { user, cookie } = await createUserAndLogin(UserRole.ADMIN);
    const draft = await createCompleteDraft(user.id);
    await prisma.draft.update({
      where: { id: draft.id },
      data: { submissionStatus: DraftSubmissionStatus.AMBIGUOUS_BLOCKED },
    });

    const response = await request(app)
      .post(`/drafts/${draft.id}/submit/resolve`)
      .set("Cookie", cookie)
      .send({ action: "invalid" });

    expect(response.status).toBe(400);
  });
});
