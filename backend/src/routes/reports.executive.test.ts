import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { createApp } from "../app";
import { prisma } from "../prisma";
import { hashPassword } from "../auth/password";

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
  return { user, cookie: loginResponse.headers["set-cookie"] };
}

const WEEK_START = "2026-01-04";

beforeEach(async () => {
  await prisma.reportConclusion.deleteMany();
  await prisma.weeklyObservation.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.draft.deleteMany();
});

afterAll(async () => {
  await prisma.reportConclusion.deleteMany();
  await prisma.weeklyObservation.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.draft.deleteMany();
  await prisma.$disconnect();
});

describe("Relatório Executivo — acesso por perfil", () => {
  it("perfil Relatório (VIEWER) consegue ler o relatório executivo, PDF e XLSX", async () => {
    const { cookie } = await createUserAndLogin(UserRole.VIEWER);

    const jsonResponse = await request(app).get(`/reports/weeks/${WEEK_START}/executive`).set("Cookie", cookie);
    expect(jsonResponse.status).toBe(200);
    expect(jsonResponse.body.week).toBeDefined();
    expect(jsonResponse.body.campaigns).toEqual([]);

    const pdfResponse = await request(app).get(`/reports/weeks/${WEEK_START}/executive/pdf`).set("Cookie", cookie);
    expect(pdfResponse.status).toBe(200);
    expect(pdfResponse.headers["content-type"]).toContain("application/pdf");

    const xlsxResponse = await request(app).get(`/reports/weeks/${WEEK_START}/executive/xlsx`).set("Cookie", cookie);
    expect(xlsxResponse.status).toBe(200);
    expect(xlsxResponse.headers["content-type"]).toContain("spreadsheetml");
  });

  it("perfil Relatório não pode escrever a conclusão do responsável", async () => {
    const { cookie } = await createUserAndLogin(UserRole.VIEWER);
    const response = await request(app)
      .put(`/reports/weeks/${WEEK_START}/conclusion`)
      .set("Cookie", cookie)
      .send({ text: "Tentativa indevida." });
    expect(response.status).toBe(403);
  });

  it("Gestor consegue escrever a conclusão e o perfil Relatório consegue lê-la (só leitura)", async () => {
    const { cookie: managerCookie } = await createUserAndLogin(UserRole.MANAGER);
    const { cookie: viewerCookie } = await createUserAndLogin(UserRole.VIEWER);

    const writeResponse = await request(app)
      .put(`/reports/weeks/${WEEK_START}/conclusion`)
      .set("Cookie", managerCookie)
      .send({ text: "O custo por conversa caiu 12% na semana." });
    expect(writeResponse.status).toBe(200);

    const readResponse = await request(app).get(`/reports/weeks/${WEEK_START}/conclusion`).set("Cookie", viewerCookie);
    expect(readResponse.status).toBe(200);
    expect(readResponse.body.text).toBe("O custo por conversa caiu 12% na semana.");
  });

  it("perfil Relatório não pode acessar rotas administrativas mesmo digitando a URL diretamente", async () => {
    const { cookie } = await createUserAndLogin(UserRole.VIEWER);

    const usersResponse = await request(app).get("/users").set("Cookie", cookie);
    expect(usersResponse.status).toBe(403);

    const integrationsResponse = await request(app).get("/integrations/meta/status").set("Cookie", cookie);
    expect(integrationsResponse.status).toBe(403);

    const draftsResponse = await request(app).get("/drafts").set("Cookie", cookie);
    expect(draftsResponse.status).toBe(403);
  });

  it("Administrador continua acessando tudo normalmente", async () => {
    const { cookie } = await createUserAndLogin(UserRole.ADMIN);

    const usersResponse = await request(app).get("/users").set("Cookie", cookie);
    expect(usersResponse.status).toBe(200);

    const integrationsResponse = await request(app).get("/integrations/meta/status").set("Cookie", cookie);
    expect(integrationsResponse.status).toBe(200);

    const draftsResponse = await request(app).get("/drafts").set("Cookie", cookie);
    expect(draftsResponse.status).toBe(200);
  });
});
