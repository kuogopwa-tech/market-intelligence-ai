function getJsonBody(req: any): Promise<any> {
  if (req.body) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: any) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).end();
    return;
  }

  try {
    const body = await getJsonBody(req);
    const { email, password } = body || {};
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    // Lazy-load DB and crypto libs
    const dbModule = await import("@workspace/db");
    const bcrypt = await import("bcryptjs");
    const jwt = await import("jsonwebtoken");
    const drizzle = await import("drizzle-orm");

    const db = (dbModule as any).db;
    const usersTable = (dbModule as any).usersTable;
    const eq = (drizzle as any).eq;

    // Query the user
    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.email, email) });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ error: "JWT_SECRET not configured in environment" });
      return;
    }

    const token = (jwt as any).sign({ id: user.id, email: user.email, role: user.role }, secret, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

    const cookie = `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
    res.setHeader("Set-Cookie", cookie);

    res.json({ user: { id: user.id, email: user.email, role: user.role }, token });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to login", details: message });
  }
}
