import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../auth/middleware";
import { createObservation, deleteObservation, listObservations } from "../observations/service";

export const observationsRouter = Router();

observationsRouter.use(requireAuth);

observationsRouter.get("/observations", async (req, res) => {
  const { weekStart } = req.query;

  if (typeof weekStart !== "string") {
    return res.status(400).json({ error: "weekStart é obrigatório." });
  }

  const parsed = new Date(`${weekStart}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return res.status(400).json({ error: "weekStart inválido." });
  }

  const observations = await listObservations(parsed);
  res.json(
    observations.map((o) => ({
      id: o.id,
      text: o.text,
      createdAt: o.createdAt,
      author: o.author,
    }))
  );
});

observationsRouter.post(
  "/observations",
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    const { weekStart, text } = req.body ?? {};

    if (typeof weekStart !== "string" || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "weekStart e text são obrigatórios." });
    }

    const parsed = new Date(`${weekStart}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ error: "weekStart inválido." });
    }

    const observation = await createObservation(parsed, text.trim(), req.currentUser!.id);
    res.status(201).json({
      id: observation.id,
      text: observation.text,
      createdAt: observation.createdAt,
      author: observation.author,
    });
  }
);

observationsRouter.delete("/observations/:id", async (req, res) => {
  const result = await deleteObservation(req.params.id, {
    id: req.currentUser!.id,
    role: req.currentUser!.role,
  });

  if (result === null) {
    return res.status(404).json({ error: "Observação não encontrada." });
  }
  if (result === "forbidden") {
    return res.status(403).json({ error: "Só o autor ou um administrador pode remover esta observação." });
  }

  res.status(204).send();
});
