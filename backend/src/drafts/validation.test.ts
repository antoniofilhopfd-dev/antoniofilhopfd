import { describe, expect, it } from "vitest";
import type { Draft } from "@prisma/client";
import { validateDraft } from "./validation";

function baseDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: "d1",
    createdById: "u1",
    campaignName: "Campanha",
    adSetName: "Conjunto",
    dailyBudget: "50" as unknown as Draft["dailyBudget"],
    country: "BR",
    ageMin: 20,
    ageMax: 45,
    adName: "Anúncio",
    facebookPageName: "Página Oficial",
    title: "Matricule-se já",
    bodyText: "Texto do anúncio dentro do limite.",
    destinationUrl: "https://exemplo.com.br/matriculas",
    callToAction: "SAIBA_MAIS" as Draft["callToAction"],
    imageFilename: "abc.png",
    imageOriginalName: "foto.png",
    imageMimeType: "image/png",
    imageSize: 1000,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("validateDraft", () => {
  it("não retorna erros para um rascunho completo e válido", () => {
    expect(validateDraft(baseDraft())).toEqual({});
  });

  it("exige URL de destino HTTPS", () => {
    const errors = validateDraft(baseDraft({ destinationUrl: "http://exemplo.com" }));
    expect(errors.destinationUrl).toMatch(/HTTPS/);
  });

  it("rejeita URL malformada", () => {
    const errors = validateDraft(baseDraft({ destinationUrl: "não é uma url" }));
    expect(errors.destinationUrl).toBeDefined();
  });

  it("exige orçamento diário maior que zero", () => {
    const errors = validateDraft(baseDraft({ dailyBudget: "0" as unknown as Draft["dailyBudget"] }));
    expect(errors.dailyBudget).toBeDefined();
  });

  it("exige imagem", () => {
    const errors = validateDraft(baseDraft({ imageFilename: null }));
    expect(errors.image).toBeDefined();
  });

  it("valida faixa etária (13 a 65) e idade máxima >= mínima", () => {
    expect(validateDraft(baseDraft({ ageMin: 10 })).ageMin).toBeDefined();
    expect(validateDraft(baseDraft({ ageMax: 70 })).ageMax).toBeDefined();
    expect(validateDraft(baseDraft({ ageMin: 40, ageMax: 20 })).ageMax).toBeDefined();
  });

  it("limita título a 40 caracteres e texto a 125", () => {
    const longTitle = "a".repeat(41);
    const longBody = "a".repeat(126);
    expect(validateDraft(baseDraft({ title: longTitle })).title).toBeDefined();
    expect(validateDraft(baseDraft({ bodyText: longBody })).bodyText).toBeDefined();
  });
});
