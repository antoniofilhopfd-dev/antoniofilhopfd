import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { CallToAction, DraftSubmissionStatus, UserRole } from "@prisma/client";
import { prisma } from "../prisma";
import { hashPassword } from "../auth/password";
import type { GraphPage, MetaClient } from "../meta/client";
import { MetaApiError } from "../meta/client";
import { SubmissionError, resolveAmbiguousSubmission, submitDraft } from "./submissionService";

const CONFIRMATIONS = {
  confirmAccount: true,
  confirmAudience: true,
  confirmBudget: true,
  confirmCreative: true,
};

beforeEach(async () => {
  await prisma.draft.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  process.env.META_ACCESS_TOKEN = "fake-token";
  process.env.META_AD_ACCOUNT_ID = "123";
});

afterAll(async () => {
  await prisma.draft.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  delete process.env.META_ACCESS_TOKEN;
  delete process.env.META_AD_ACCOUNT_ID;
  await prisma.$disconnect();
});

async function createUser(role: UserRole, canSubmitToMeta = false) {
  return prisma.user.create({
    data: {
      name: "Usuário",
      email: `${role.toLowerCase()}-${Date.now()}-${Math.random()}@evolucao.test`,
      passwordHash: await hashPassword("senha-valida-123"),
      role,
      canSubmitToMeta,
    },
  });
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

function fakeClient(handlers: {
  post: (path: string, body: Record<string, unknown>) => Promise<{ id: string }>;
}): MetaClient {
  return {
    get: async () => ({ data: [], nextUrl: null }) as GraphPage<never>,
    getPage: async () => ({ data: [], nextUrl: null }) as GraphPage<never>,
    post: handlers.post as MetaClient["post"],
  };
}

describe("submitDraft", () => {
  it("cria campanha, conjunto, criativo e anúncio pausados, persistindo cada id", async () => {
    const admin = await createUser(UserRole.ADMIN);
    const draft = await createCompleteDraft(admin.id);

    const calls: string[] = [];
    const client = fakeClient({
      post: async (path) => {
        calls.push(path);
        if (path.endsWith("/campaigns")) return { id: "camp-1" };
        if (path.endsWith("/adsets")) return { id: "adset-1" };
        if (path.endsWith("/adcreatives")) return { id: "creative-1" };
        if (path.endsWith("/ads")) return { id: "ad-1" };
        throw new Error("path inesperado: " + path);
      },
    });

    const result = await submitDraft(
      draft.id,
      { id: admin.id, role: admin.role, canSubmitToMeta: admin.canSubmitToMeta },
      CONFIRMATIONS,
      client
    );

    expect(result.submissionStatus).toBe(DraftSubmissionStatus.SUBMITTED);
    expect(result.submittedCampaignExternalId).toBe("camp-1");
    expect(result.submittedAdSetExternalId).toBe("adset-1");
    expect(result.submittedCreativeExternalId).toBe("creative-1");
    expect(result.submittedAdExternalId).toBe("ad-1");
    expect(result.submittedById).toBe(admin.id);
    expect(calls).toEqual([
      "act_123/campaigns",
      "act_123/adsets",
      "act_123/adcreatives",
      "act_123/ads",
    ]);
  });

  it("em nova tentativa após falha clara, retoma só das etapas ainda não confirmadas", async () => {
    const admin = await createUser(UserRole.ADMIN);
    const draft = await createCompleteDraft(admin.id);

    const failingClient = fakeClient({
      post: async (path) => {
        if (path.endsWith("/campaigns")) return { id: "camp-1" };
        if (path.endsWith("/adsets")) throw new MetaApiError("unknown", "Falha clara ao criar conjunto.");
        throw new Error("path inesperado: " + path);
      },
    });

    await expect(
      submitDraft(
        draft.id,
        { id: admin.id, role: admin.role, canSubmitToMeta: admin.canSubmitToMeta },
        CONFIRMATIONS,
        failingClient
      )
    ).rejects.toThrow(SubmissionError);

    const afterFailure = await prisma.draft.findUniqueOrThrow({ where: { id: draft.id } });
    expect(afterFailure.submissionStatus).toBe(DraftSubmissionStatus.FAILED);
    expect(afterFailure.submittedCampaignExternalId).toBe("camp-1");
    expect(afterFailure.submittedAdSetExternalId).toBeNull();

    const calls: string[] = [];
    const succeedingClient = fakeClient({
      post: async (path) => {
        calls.push(path);
        if (path.endsWith("/adsets")) return { id: "adset-1" };
        if (path.endsWith("/adcreatives")) return { id: "creative-1" };
        if (path.endsWith("/ads")) return { id: "ad-1" };
        throw new Error("path inesperado: " + path);
      },
    });

    const result = await submitDraft(
      draft.id,
      { id: admin.id, role: admin.role, canSubmitToMeta: admin.canSubmitToMeta },
      CONFIRMATIONS,
      succeedingClient
    );

    expect(result.submissionStatus).toBe(DraftSubmissionStatus.SUBMITTED);
    // Campanha não deve ter sido recriada — só as etapas seguintes.
    expect(calls).toEqual(["act_123/adsets", "act_123/adcreatives", "act_123/ads"]);
  });

  it("bloqueia reenvio automático quando a resposta da Meta é ambígua", async () => {
    const admin = await createUser(UserRole.ADMIN);
    const draft = await createCompleteDraft(admin.id);

    const ambiguousClient = fakeClient({
      post: async (path) => {
        if (path.endsWith("/campaigns")) return { id: "camp-1" };
        throw new MetaApiError("ambiguous", "Falha de rede; resultado indeterminado.");
      },
    });

    await expect(
      submitDraft(
        draft.id,
        { id: admin.id, role: admin.role, canSubmitToMeta: admin.canSubmitToMeta },
        CONFIRMATIONS,
        ambiguousClient
      )
    ).rejects.toMatchObject({ code: "blocked_ambiguous" });

    const afterFirst = await prisma.draft.findUniqueOrThrow({ where: { id: draft.id } });
    expect(afterFirst.submissionStatus).toBe(DraftSubmissionStatus.AMBIGUOUS_BLOCKED);

    const neverCalledClient = fakeClient({
      post: async () => {
        throw new Error("não deveria ser chamado enquanto bloqueado");
      },
    });

    await expect(
      submitDraft(
        draft.id,
        { id: admin.id, role: admin.role, canSubmitToMeta: admin.canSubmitToMeta },
        CONFIRMATIONS,
        neverCalledClient
      )
    ).rejects.toMatchObject({ code: "blocked_ambiguous" });
  });

  it("impede envio concorrente do mesmo rascunho", async () => {
    const admin = await createUser(UserRole.ADMIN);
    const draft = await createCompleteDraft(admin.id);

    let resolveCampaign: (value: { id: string }) => void = () => {};
    const pending = new Promise<{ id: string }>((resolve) => {
      resolveCampaign = resolve;
    });

    const slowClient = fakeClient({
      post: async (path) => {
        if (path.endsWith("/campaigns")) return pending;
        throw new Error("path inesperado: " + path);
      },
    });

    const firstCall = submitDraft(
      draft.id,
      { id: admin.id, role: admin.role, canSubmitToMeta: admin.canSubmitToMeta },
      CONFIRMATIONS,
      slowClient
    );

    await new Promise((resolve) => setTimeout(resolve, 20));

    await expect(
      submitDraft(
        draft.id,
        { id: admin.id, role: admin.role, canSubmitToMeta: admin.canSubmitToMeta },
        CONFIRMATIONS,
        slowClient
      )
    ).rejects.toMatchObject({ code: "in_progress" });

    resolveCampaign({ id: "camp-1" });
    await expect(firstCall).rejects.toThrow();
  });

  it("exige as quatro confirmações explícitas", async () => {
    const admin = await createUser(UserRole.ADMIN);
    const draft = await createCompleteDraft(admin.id);

    await expect(
      submitDraft(
        draft.id,
        { id: admin.id, role: admin.role, canSubmitToMeta: admin.canSubmitToMeta },
        { ...CONFIRMATIONS, confirmBudget: false },
        fakeClient({ post: async () => ({ id: "x" }) })
      )
    ).rejects.toMatchObject({ code: "confirmation_required" });
  });

  it("bloqueia rascunho incompleto", async () => {
    const admin = await createUser(UserRole.ADMIN);
    const draft = await prisma.draft.create({ data: { createdById: admin.id } });

    await expect(
      submitDraft(
        draft.id,
        { id: admin.id, role: admin.role, canSubmitToMeta: admin.canSubmitToMeta },
        CONFIRMATIONS,
        fakeClient({ post: async () => ({ id: "x" }) })
      )
    ).rejects.toMatchObject({ code: "incomplete" });
  });

  it("bloqueia Gestor sem permissão individual e permite quando concedida", async () => {
    const manager = await createUser(UserRole.MANAGER, false);
    const draft = await createCompleteDraft(manager.id);

    await expect(
      submitDraft(
        draft.id,
        { id: manager.id, role: manager.role, canSubmitToMeta: manager.canSubmitToMeta },
        CONFIRMATIONS,
        fakeClient({ post: async () => ({ id: "x" }) })
      )
    ).rejects.toMatchObject({ code: "no_permission" });

    await prisma.user.update({ where: { id: manager.id }, data: { canSubmitToMeta: true } });

    const client = fakeClient({
      post: async (path) => ({ id: path.split("/")[1] + "-id" }),
    });

    const result = await submitDraft(
      draft.id,
      { id: manager.id, role: manager.role, canSubmitToMeta: true },
      CONFIRMATIONS,
      client
    );
    expect(result.submissionStatus).toBe(DraftSubmissionStatus.SUBMITTED);
  });

  it("recusa quando a integração Meta não está configurada", async () => {
    delete process.env.META_ACCESS_TOKEN;
    const admin = await createUser(UserRole.ADMIN);
    const draft = await createCompleteDraft(admin.id);

    await expect(
      submitDraft(
        draft.id,
        { id: admin.id, role: admin.role, canSubmitToMeta: admin.canSubmitToMeta },
        CONFIRMATIONS,
        fakeClient({ post: async () => ({ id: "x" }) })
      )
    ).rejects.toMatchObject({ code: "not_configured" });
  });
});

describe("resolveAmbiguousSubmission", () => {
  it("libera para nova tentativa quando o admin confirma que a etapa não foi criada", async () => {
    const admin = await createUser(UserRole.ADMIN);
    const draft = await createCompleteDraft(admin.id);
    await prisma.draft.update({
      where: { id: draft.id },
      data: { submissionStatus: DraftSubmissionStatus.AMBIGUOUS_BLOCKED, lastSubmissionError: "indeterminado" },
    });

    const result = await resolveAmbiguousSubmission(draft.id, "retry");
    expect(result.submissionStatus).toBe(DraftSubmissionStatus.FAILED);
    expect(result.lastSubmissionError).toBeNull();
  });

  it("marca como falho definitivo quando o admin confirma criação órfã na Meta", async () => {
    const admin = await createUser(UserRole.ADMIN);
    const draft = await createCompleteDraft(admin.id);
    await prisma.draft.update({
      where: { id: draft.id },
      data: { submissionStatus: DraftSubmissionStatus.AMBIGUOUS_BLOCKED },
    });

    const result = await resolveAmbiguousSubmission(draft.id, "reset_confirmed_steps");
    expect(result.submissionStatus).toBe(DraftSubmissionStatus.FAILED);
    expect(result.lastSubmissionError).toMatch(/conferir/);
  });

  it("recusa quando o rascunho não está bloqueado por ambiguidade", async () => {
    const admin = await createUser(UserRole.ADMIN);
    const draft = await createCompleteDraft(admin.id);

    await expect(resolveAmbiguousSubmission(draft.id, "retry")).rejects.toMatchObject({
      code: "blocked_ambiguous",
    });
  });
});
