import type { Draft } from "@prisma/client";

export type FieldErrors = Record<string, string>;

// Validação por campo (Seção 12) — usada na Revisão para mostrar o que
// falta/está inválido antes de habilitar o envio (Etapa 10). Salvar o
// rascunho continua permitido mesmo incompleto.
export function validateDraft(draft: Draft): FieldErrors {
  const errors: FieldErrors = {};

  if (!draft.campaignName || draft.campaignName.trim().length === 0) {
    errors.campaignName = "Nome da campanha é obrigatório.";
  }

  if (!draft.adSetName || draft.adSetName.trim().length === 0) {
    errors.adSetName = "Nome do conjunto é obrigatório.";
  }
  if (draft.dailyBudget === null || Number(draft.dailyBudget) <= 0) {
    errors.dailyBudget = "Orçamento diário deve ser maior que zero (BRL).";
  }
  if (!draft.country) {
    errors.country = "País é obrigatório.";
  }
  if (draft.ageMin === null || draft.ageMin < 13 || draft.ageMin > 65) {
    errors.ageMin = "Idade mínima deve estar entre 13 e 65.";
  }
  if (draft.ageMax === null || draft.ageMax < 13 || draft.ageMax > 65) {
    errors.ageMax = "Idade máxima deve estar entre 13 e 65.";
  }
  if (
    draft.ageMin !== null &&
    draft.ageMax !== null &&
    draft.ageMin > draft.ageMax
  ) {
    errors.ageMax = "Idade máxima deve ser maior ou igual à idade mínima.";
  }

  if (!draft.adName || draft.adName.trim().length === 0) {
    errors.adName = "Nome do anúncio é obrigatório.";
  }
  if (!draft.facebookPageName || draft.facebookPageName.trim().length === 0) {
    errors.facebookPageName = "Página do Facebook é obrigatória.";
  }
  if (!draft.title || draft.title.trim().length === 0) {
    errors.title = "Título é obrigatório.";
  } else if (draft.title.length > 40) {
    errors.title = "Título deve ter até 40 caracteres.";
  }
  if (!draft.bodyText || draft.bodyText.trim().length === 0) {
    errors.bodyText = "Texto do anúncio é obrigatório.";
  } else if (draft.bodyText.length > 125) {
    errors.bodyText = "Texto deve ter até 125 caracteres.";
  }
  if (!draft.destinationUrl) {
    errors.destinationUrl = "URL de destino é obrigatória.";
  } else {
    try {
      const url = new URL(draft.destinationUrl);
      if (url.protocol !== "https:") {
        errors.destinationUrl = "URL de destino deve ser HTTPS.";
      }
    } catch {
      errors.destinationUrl = "URL de destino inválida.";
    }
  }
  if (!draft.callToAction) {
    errors.callToAction = "Chamada para ação é obrigatória.";
  }

  if (!draft.imageFilename) {
    errors.image = "Imagem é obrigatória (PNG ou JPEG).";
  }

  return errors;
}

export function isDraftComplete(draft: Draft): boolean {
  return Object.keys(validateDraft(draft)).length === 0;
}
