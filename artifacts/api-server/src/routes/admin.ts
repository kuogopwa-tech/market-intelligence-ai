/**
 * admin.ts
 *
 * Admin-only endpoints for user management and system administration.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, desc, sql, and, isNotNull, isNull } from "drizzle-orm";
import { trackUserActivity } from "../middleware/auth.js";

const router: Router = Router();

// In-memory set to track users who have activity tracked recently
const activeUserIds = new Set<string>();
const INACTIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// Clean up stale active users periodically
setInterval(() => {
  const cutoff = Date.now() - INACTIVE_THRESHOLD_MS;
  activeUserIds.forEach((userId) => {
    // This is a simple cleanup - actual isOnline is tracked in DB
  });
}, INACTIVE_THRESHOLD_MS);

/**
 * GET /admin/users
 *
 * Returns all users with their online status.
 * Requires admin role.
 */
router.get("/admin/users", async (req, res) => {
  try {
    // Require admin role
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    // Get all users
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        role: usersTable.role,
        lastActiveAt: usersTable.lastActiveAt,
        isOnline: usersTable.isOnline,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));

    // Calculate active users (those active in last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const activeUsers = users.filter((u) => {
      if (u.isOnline) return true;
      if (u.lastActiveAt && u.lastActiveAt > fiveMinutesAgo) return true;
      return false;
    });

    const inactiveUsers = users.filter((u) => {
      if (u.isOnline) return false;
      if (u.lastActiveAt && u.lastActiveAt > fiveMinutesAgo) return false;
      return true;
    });

    res.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        isOnline: u.isOnline,
        lastActiveAt: u.lastActiveAt
          ? Math.floor(u.lastActiveAt.getTime() / 1000)
          : null,
        createdAt: Math.floor(u.createdAt.getTime() / 1000),
        status:
          u.isOnline
            ? "online"
            : u.lastActiveAt && u.lastActiveAt > fiveMinutesAgo
            ? "active"
            : "offline",
      })),
      stats: {
        total: users.length,
        online: users.filter((u) => u.isOnline).length,
        active: activeUsers.length,
        inactive: inactiveUsers.length,
      },
      activeUsers: activeUsers.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        lastActiveAt: u.lastActiveAt
          ? Math.floor(u.lastActiveAt.getTime() / 1000)
          : null,
      })),
      inactiveUsers: inactiveUsers.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        lastActiveAt: u.lastActiveAt
          ? Math.floor(u.lastActiveAt.getTime() / 1000)
          : null,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Admin users fetch failed");
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

/**
 * POST /admin/activity
 *
 * Track user activity - called by frontend periodically.
 * Body: { userId: string }
 */
router.post("/admin/activity", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: "User ID required" });
      return;
    }

    // Track activity
    await trackUserActivity(userId);

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Activity tracking failed");
    res.status(500).json({ error: "Failed to track activity" });
  }
});

/**
 * GET /admin/stats
 *
 * Returns system-wide statistics.
 * Requires admin role.
 */
router.get("/admin/stats", async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    // Get user counts
    const totalUsers = await db
      .select({ count: sql<number>`count(*)` })
      .from(usersTable);

    const onlineUsers = await db
      .select({ count: sql<number>`count(*)` })
      .from(usersTable)
      .where(eq(usersTable.isOnline, true));

    const activeUsers = await db
      .select({ count: sql<number>`count(*)` })
      .from(usersTable)
      .where(
        and(
          isNotNull(usersTable.lastActiveAt),
          sql`${usersTable.lastActiveAt} > now() - interval '5 minutes'`
        )
      );

    res.json({
      users: {
        total: totalUsers[0]?.count ?? 0,
        online: onlineUsers[0]?.count ?? 0,
        active: activeUsers[0]?.count ?? 0,
      },
      timestamp: Math.floor(Date.now() / 1000),
    });
  } catch (err) {
    req.log.error({ err }, "Admin stats failed");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
