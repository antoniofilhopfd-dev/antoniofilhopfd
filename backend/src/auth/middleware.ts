import type { NextFunction, Request, Response } from "express";
import type { User, UserRole } from "@prisma/client";
import { SESSION_COOKIE_NAME, getUserBySessionToken } from "./session";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      currentUser?: User;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ error: "Sessão ausente." });
  }

  const result = await getUserBySessionToken(token);

  if (!result) {
    return res.status(401).json({ error: "Sessão inválida ou expirada." });
  }

  req.currentUser = result.user;
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
      return res.status(401).json({ error: "Sessão ausente." });
    }

    if (!roles.includes(req.currentUser.role)) {
      return res.status(403).json({ error: "Perfil sem permissão para esta ação." });
    }

    next();
  };
}
