import fs from "node:fs";
import { DraftSubmissionStatus, UserRole, type Draft } from "@prisma/client";
import { prisma } from "../prisma";
import { UPLOAD_DIR } from "./service";
import { validateDraft } from "./validation";
import { MetaApiError, createMetaClient, type MetaClient } from "../meta/client";
import { getMetaConfig } from "../meta/config";

export class SubmissionError extends Error {
  code:
    | "not_configured"
    | "incomplete"
    | "no_permission"
    | "in_progress"
    | "blocked_ambiguous"
    | "confirmation_required"
    | "rejected";
  fieldErrors?: Record<string, string>;

  constructor(code: SubmissionError["code"], message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export type SubmitConfirmations = {
  confirmAccount: boolean;
  confirmAudience: boolean;
  confirmBudget: boolean;
  confirmCreative: boolean;
};

const CTA_MAP: Record<string, string> = {
  SAIBA_MAIS: "LEARN_MORE",
  CADASTRE_SE: "SIGN_UP",
  FALE_CONOSCO: "CONTACT_US",
  GARANTA_JA: "APPLY_NOW",
};

function canUserSubmit(role: UserRole, canSubmitToMeta: boolean): boolean {
  if (role === UserRole.ADMIN) return true;
  if (role === UserRole.MANAGER) return canSubmitToMeta;
  return false;
}

async function acquireLock(draftId: string): Promise<boolean> {
  const result = await prisma.draft.updateMany({
    where: {
      id: draftId,
      submissionStatus: { in: [DraftSubmissionStatus.NOT_SUBMITTED, DraftSubmissionStatus.FAILED] },
    },
    data: { submissionStatus: DraftSubmissionStatus.SUBMITTING },
  });
  return result.count === 1;
}

async function markFailed(draftId: string, message: string) {
  await prisma.draft.update({
    where: { id: draftId },
    data: { submissionStatus: DraftSubmissionStatus.FAILED, lastSubmissionError: message },
  });
}

async function markAmbiguous(draftId: string, message: string) {
  await prisma.draft.update({
    where: { id: draftId },
    data: { submissionStatus: DraftSubmissionStatus.AMBIGUOUS_BLOCKED, lastSubmissionError: message },
  });
}

export async function submitDraft(
  draftId: string,
  requester: { id: string; role: UserRole; canSubmitToMeta: boolean },
  confirmations: SubmitConfirmations,
  client: MetaClient = createMetaClient()
): Promise<Draft> {
  const { configured, adAccountId } = getMetaConfig();

  if (!configured) {
    throw new SubmissionError("not_configured", "Integração Meta não configurada.");
  }

  if (!canUserSubmit(requester.role, requester.canSubmitToMeta)) {
    throw new SubmissionError(
      "no_permission",
      "Seu perfil não tem permissão para enviar rascunhos à Meta. Peça a um Administrador para conceder a permissão individual."
    );
  }

  if (
    !confirmations.confirmAccount ||
    !confirmations.confirmAudience ||
    !confirmations.confirmBudget ||
    !confirmations.confirmCreative
  ) {
    throw new SubmissionError(
      "confirmation_required",
      "É preciso confirmar explicitamente conta, público, orçamento e criativo antes de enviar."
    );
  }

  const draft = await prisma.draft.findUniqueOrThrow({ where: { id: draftId } });

  if (draft.submissionStatus === DraftSubmissionStatus.AMBIGUOUS_BLOCKED) {
    throw new SubmissionError(
      "blocked_ambiguous",
      "Um envio anterior teve resultado indeterminado. Só um Administrador pode liberar este rascunho após conferência manual na Meta."
    );
  }
  if (draft.submissionStatus === DraftSubmissionStatus.SUBMITTED) {
    return draft;
  }

  const fieldErrors = validateDraft(draft);
  if (Object.keys(fieldErrors).length > 0) {
    throw new SubmissionError("incomplete", "Rascunho incompleto ou inválido.", fieldErrors);
  }

  const locked = await acquireLock(draftId);
  if (!locked) {
    throw new SubmissionError("in_progress", "Já existe um envio em andamento para este rascunho.");
  }

  try {
    let campaignId = draft.submittedCampaignExternalId;
    if (!campaignId) {
      const result = await client.post<{ id: string }>(`act_${adAccountId}/campaigns`, {
        name: draft.campaignName,
        objective: "OUTCOME_TRAFFIC",
        status: "PAUSED",
        special_ad_categories: [],
      });
      campaignId = result.id;
      await prisma.draft.update({ where: { id: draftId }, data: { submittedCampaignExternalId: campaignId } });
    }

    let adSetId = draft.submittedAdSetExternalId;
    if (!adSetId) {
      const result = await client.post<{ id: string }>(`act_${adAccountId}/adsets`, {
        name: draft.adSetName,
        campaign_id: campaignId,
        daily_budget: Math.round(Number(draft.dailyBudget) * 100),
        billing_event: "IMPRESSIONS",
        optimization_goal: "LINK_CLICKS",
        status: "PAUSED",
        targeting: {
          geo_locations: { countries: [draft.country ?? "BR"] },
          age_min: draft.ageMin,
          age_max: draft.ageMax,
        },
      });
      adSetId = result.id;
      await prisma.draft.update({ where: { id: draftId }, data: { submittedAdSetExternalId: adSetId } });
    }

    let creativeId = draft.submittedCreativeExternalId;
    if (!creativeId) {
      const imagePath = draft.imageFilename ? `${UPLOAD_DIR}/${draft.imageFilename}` : null;
      const imageBase64 = imagePath && fs.existsSync(imagePath) ? fs.readFileSync(imagePath).toString("base64") : null;

      const result = await client.post<{ id: string }>(`act_${adAccountId}/adcreatives`, {
        name: `${draft.adName} - criativo`,
        object_story_spec: {
          page_id: draft.facebookPageName,
          link_data: {
            image_data: imageBase64 ? { bytes: imageBase64 } : undefined,
            link: draft.destinationUrl,
            message: draft.bodyText,
            name: draft.title,
            call_to_action: {
              type: draft.callToAction ? CTA_MAP[draft.callToAction] : undefined,
              value: { link: draft.destinationUrl },
            },
          },
        },
      });
      creativeId = result.id;
      await prisma.draft.update({ where: { id: draftId }, data: { submittedCreativeExternalId: creativeId } });
    }

    let adId = draft.submittedAdExternalId;
    if (!adId) {
      const result = await client.post<{ id: string }>(`act_${adAccountId}/ads`, {
        name: draft.adName,
        adset_id: adSetId,
        creative: { creative_id: creativeId },
        status: "PAUSED",
      });
      adId = result.id;
      await prisma.draft.update({ where: { id: draftId }, data: { submittedAdExternalId: adId } });
    }

    return prisma.draft.update({
      where: { id: draftId },
      data: {
        submissionStatus: DraftSubmissionStatus.SUBMITTED,
        submittedAt: new Date(),
        submittedById: requester.id,
        lastSubmissionError: null,
      },
    });
  } catch (error) {
    if (error instanceof MetaApiError && error.kind === "ambiguous") {
      await markAmbiguous(draftId, error.message);
      throw new SubmissionError(
        "blocked_ambiguous",
        "Resultado indeterminado ao criar objeto na Meta. O rascunho foi bloqueado para conferência administrativa — não tente reenviar automaticamente."
      );
    }

    const message = error instanceof Error ? error.message : "Erro desconhecido ao enviar à Meta.";
    await markFailed(draftId, message);
    throw new SubmissionError("rejected", message);
  }
}

// Só ADMIN, após conferir manualmente na Meta se os objetos indicados
// pelos identificadores parciais já existem ou não (Seção 12: "Após
// recusa definitiva, retomar somente etapas seguramente confirmadas").
export async function resolveAmbiguousSubmission(
  draftId: string,
  action: "retry" | "reset_confirmed_steps"
): Promise<Draft> {
  const draft = await prisma.draft.findUniqueOrThrow({ where: { id: draftId } });

  if (draft.submissionStatus !== DraftSubmissionStatus.AMBIGUOUS_BLOCKED) {
    throw new SubmissionError("blocked_ambiguous", "Este rascunho não está bloqueado por ambiguidade.");
  }

  if (action === "retry") {
    // O administrador confirmou manualmente que a última etapa NÃO foi
    // criada na Meta — libera para tentar de novo a partir do que já
    // estava confirmado antes dela.
    return prisma.draft.update({
      where: { id: draftId },
      data: { submissionStatus: DraftSubmissionStatus.FAILED, lastSubmissionError: null },
    });
  }

  // O administrador confirmou manualmente que a última etapa FOI criada
  // na Meta, mas nossa resposta local não confirmou — como não temos o
  // identificador retornado, o rascunho fica travado como falho
  // definitivo; a limpeza do objeto órfão na Meta é manual.
  return prisma.draft.update({
    where: { id: draftId },
    data: {
      submissionStatus: DraftSubmissionStatus.FAILED,
      lastSubmissionError:
        "Marcado manualmente como possivelmente criado na Meta sem identificador confirmado; conferir e limpar manualmente antes de reenviar.",
    },
  });
}
