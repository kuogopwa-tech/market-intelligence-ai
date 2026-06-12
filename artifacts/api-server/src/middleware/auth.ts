import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { JWT_SECRET } from "../lib/config.js";

export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "user";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.cookies?.token;

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (err) {
    logger.debug({ err }, "Invalid token");
    next();
  }
};

export const requireAuth = () => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
};

export const requireAdmin = () => (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }
  next();
};

// Track user activity - call this on each authenticated request
export const trackUserActivity = async (userId: string): Promise<void> => {
  try {
    await db
      .update(usersTable)
      .set({
        lastActiveAt: new Date(),
        isOnline: true,
      })
      .where(eq(usersTable.id, userId));
  } catch (err) {
    logger.debug({ err, userId }, "Failed to track user activity");
  }
};

// Mark user as offline (call on disconnect or after inactivity)
export const markUserOffline = async (userId: string): Promise<void> => {
  try {
    await db
      .update(usersTable)
      .set({ isOnline: false })
      .where(eq(usersTable.id, userId));
  } catch (err) {
    logger.debug({ err, userId }, "Failed to mark user offline");
  }
};

