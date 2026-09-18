import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { CallToAction, UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../auth/middleware";
import {
  MAX_IMAGE_BYTES,
  UPLOAD_DIR,
  createDraft,
  deleteDraft,
  deleteDraftImage,
  getDraft,
  isAllowedImageMimeType,
  listDrafts,
  saveDraftImage,
  updateDraft,
} from "../drafts/service";
import { validateDraft } from "../drafts/validation";

export const draftsRouter = Router();

draftsRouter.use(requireAuth);
// Rascunhos ficam fora do perfil Relatório por completo (incremento
// "Área de Relatórios") — inclusive leitura, não só escrita.
draftsRouter.use(requireRole(UserRole.ADMIN, UserRole.MANAGER));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
});

function serializeDraft(draft: NonNullable<Awaited<ReturnType<typeof getDraft>>>) {
  return {
    id: draft.id,
    createdBy: draft.createdBy,
    campaignName: draft.campaignName,
    adSetName: draft.adSetName,
    dailyBudget: draft.dailyBudget ? Number(draft.dailyBudget) : null,
    country: draft.country,
    ageMin: draft.ageMin,
    ageMax: draft.ageMax,
    adName: draft.adName,
    facebookPageName: draft.facebookPageName,
    title: draft.title,
    bodyText: draft.bodyText,
    destinationUrl: draft.destinationUrl,
    callToAction: draft.callToAction,
    hasImage: Boolean(draft.imageFilename),
    imageOriginalName: draft.imageOriginalName,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

async function ensureDraftAccess(
  req: Parameters<typeof requireAuth>[0],
  draftId: string
): Promise<{ draft: NonNullable<Awaited<ReturnType<typeof getDraft>>> } | { error: number }> {
  const draft = await getDraft(draftId);
  if (!draft) return { error: 404 };
  if (req.currentUser!.role !== UserRole.ADMIN && draft.createdById !== req.currentUser!.id) {
    return { error: 403 };
  }
  return { draft };
}

draftsRouter.get("/drafts", async (req, res) => {
  const drafts = await listDrafts(req.currentUser!.id, req.currentUser!.role);
  res.json(drafts.map(serializeDraft));
});

draftsRouter.post("/drafts", requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req, res) => {
  const draft = await createDraft(req.currentUser!.id);
  res.status(201).json(serializeDraft(draft));
});

draftsRouter.get("/drafts/:id", async (req, res) => {
  const access = await ensureDraftAccess(req, req.params.id);
  if ("error" in access) {
    return res.status(access.error).json({ error: access.error === 404 ? "Rascunho não encontrado." : "Sem permissão." });
  }
  res.json(serializeDraft(access.draft));
});

draftsRouter.get("/drafts/:id/validation", async (req, res) => {
  const access = await ensureDraftAccess(req, req.params.id);
  if ("error" in access) {
    return res.status(access.error).json({ error: access.error === 404 ? "Rascunho não encontrado." : "Sem permissão." });
  }
  res.json({ fieldErrors: validateDraft(access.draft), complete: Object.keys(validateDraft(access.draft)).length === 0 });
});

draftsRouter.patch(
  "/drafts/:id",
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    const access = await ensureDraftAccess(req, req.params.id);
    if ("error" in access) {
      return res.status(access.error).json({ error: access.error === 404 ? "Rascunho não encontrado." : "Sem permissão." });
    }

    const body = req.body ?? {};
    const patch: Record<string, unknown> = {};

    if (typeof body.campaignName === "string") patch.campaignName = body.campaignName;
    if (typeof body.adSetName === "string") patch.adSetName = body.adSetName;
    if (body.dailyBudget !== undefined) {
      const n = Number(body.dailyBudget);
      if (!Number.isFinite(n)) return res.status(400).json({ error: "dailyBudget inválido." });
      patch.dailyBudget = n;
    }
    if (typeof body.country === "string") patch.country = body.country;
    if (body.ageMin !== undefined) {
      const n = Number(body.ageMin);
      if (!Number.isInteger(n)) return res.status(400).json({ error: "ageMin inválido." });
      patch.ageMin = n;
    }
    if (body.ageMax !== undefined) {
      const n = Number(body.ageMax);
      if (!Number.isInteger(n)) return res.status(400).json({ error: "ageMax inválido." });
      patch.ageMax = n;
    }
    if (typeof body.adName === "string") patch.adName = body.adName;
    if (typeof body.facebookPageName === "string") patch.facebookPageName = body.facebookPageName;
    if (typeof body.title === "string") patch.title = body.title;
    if (typeof body.bodyText === "string") patch.bodyText = body.bodyText;
    if (typeof body.destinationUrl === "string") patch.destinationUrl = body.destinationUrl;
    if (body.callToAction !== undefined) {
      if (!Object.values(CallToAction).includes(body.callToAction)) {
        return res.status(400).json({ error: "callToAction inválido." });
      }
      patch.callToAction = body.callToAction;
    }

    const updated = await updateDraft(req.params.id, patch);
    res.json(serializeDraft(updated));
  }
);

draftsRouter.delete("/drafts/:id", requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req, res) => {
  const access = await ensureDraftAccess(req, req.params.id);
  if ("error" in access) {
    return res.status(access.error).json({ error: access.error === 404 ? "Rascunho não encontrado." : "Sem permissão." });
  }
  await deleteDraft(req.params.id);
  res.status(204).send();
});

draftsRouter.post(
  "/drafts/:id/image",
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  upload.single("image"),
  async (req, res) => {
    const access = await ensureDraftAccess(req, req.params.id);
    if ("error" in access) {
      return res.status(access.error).json({ error: access.error === 404 ? "Rascunho não encontrado." : "Sem permissão." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Arquivo de imagem é obrigatório." });
    }
    if (!isAllowedImageMimeType(req.file.mimetype)) {
      return res.status(400).json({ error: "Formato de imagem inválido. Use PNG ou JPEG." });
    }

    const updated = await saveDraftImage(req.params.id, {
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
    res.json(serializeDraft(updated));
  }
);

draftsRouter.delete(
  "/drafts/:id/image",
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    const access = await ensureDraftAccess(req, req.params.id);
    if ("error" in access) {
      return res.status(access.error).json({ error: access.error === 404 ? "Rascunho não encontrado." : "Sem permissão." });
    }
    const updated = await deleteDraftImage(req.params.id);
    res.json(serializeDraft(updated));
  }
);

draftsRouter.get("/drafts/:id/image", async (req, res) => {
  const access = await ensureDraftAccess(req, req.params.id);
  if ("error" in access) {
    return res.status(access.error).json({ error: access.error === 404 ? "Rascunho não encontrado." : "Sem permissão." });
  }
  if (!access.draft.imageFilename) {
    return res.status(404).json({ error: "Rascunho sem imagem." });
  }
  res.sendFile(path.join(UPLOAD_DIR, access.draft.imageFilename));
});
