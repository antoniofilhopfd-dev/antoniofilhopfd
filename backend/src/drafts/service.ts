import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { CallToAction } from "@prisma/client";
import { prisma } from "../prisma";

export const UPLOAD_DIR = path.join(process.cwd(), "uploads", "drafts");

const EDITABLE_FIELDS = [
  "campaignName",
  "adSetName",
  "dailyBudget",
  "country",
  "ageMin",
  "ageMax",
  "adName",
  "facebookPageName",
  "title",
  "bodyText",
  "destinationUrl",
  "callToAction",
] as const;

export type DraftPatch = Partial<{
  campaignName: string;
  adSetName: string;
  dailyBudget: number;
  country: string;
  ageMin: number;
  ageMax: number;
  adName: string;
  facebookPageName: string;
  title: string;
  bodyText: string;
  destinationUrl: string;
  callToAction: CallToAction;
}>;

export async function listDrafts(userId: string, role: string) {
  // Admin vê todos os rascunhos; Gestor vê os seus (Seção 5: "Cria e
  // edita rascunhos" não implica ver os de outros gestores nesta etapa).
  const where = role === "ADMIN" ? {} : { createdById: userId };
  return prisma.draft.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function createDraft(createdById: string) {
  return prisma.draft.create({
    data: { createdById },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function getDraft(id: string) {
  return prisma.draft.findUnique({ where: { id }, include: { createdBy: { select: { id: true, name: true } } } });
}

export async function updateDraft(id: string, patch: DraftPatch) {
  const data: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in patch) {
      data[key] = patch[key];
    }
  }
  return prisma.draft.update({
    where: { id },
    data,
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function deleteDraft(id: string) {
  const draft = await prisma.draft.findUnique({ where: { id } });
  if (draft?.imageFilename) {
    await fs.unlink(path.join(UPLOAD_DIR, draft.imageFilename)).catch(() => {});
  }
  await prisma.draft.delete({ where: { id } });
}

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg"]);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function isAllowedImageMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

// O mimetype do multipart é declarado pelo cliente e pode ser forjado —
// confere os bytes reais do arquivo (assinatura binária) antes de aceitar,
// em vez de confiar só no cabeçalho Content-Type.
export function matchesImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/png") {
    return buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
  }
  if (mimeType === "image/jpeg") {
    return buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE);
  }
  return false;
}

export async function saveDraftImage(
  id: string,
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number }
) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const existing = await prisma.draft.findUnique({ where: { id } });
  if (existing?.imageFilename) {
    await fs.unlink(path.join(UPLOAD_DIR, existing.imageFilename)).catch(() => {});
  }

  const ext = file.mimetype === "image/png" ? ".png" : ".jpg";
  const filename = `${id}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), file.buffer);

  return prisma.draft.update({
    where: { id },
    data: {
      imageFilename: filename,
      imageOriginalName: file.originalname,
      imageMimeType: file.mimetype,
      imageSize: file.size,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function deleteDraftImage(id: string) {
  const draft = await prisma.draft.findUnique({ where: { id } });
  if (draft?.imageFilename) {
    await fs.unlink(path.join(UPLOAD_DIR, draft.imageFilename)).catch(() => {});
  }
  return prisma.draft.update({
    where: { id },
    data: { imageFilename: null, imageOriginalName: null, imageMimeType: null, imageSize: null },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}
