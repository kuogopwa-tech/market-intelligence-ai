import { db, usersTable } from "../lib/db/src";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.");
    process.exit(1);
  }

  console.log(`Checking if admin user exists: ${email}...`);

  try {
    const existingUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, email),
    });

    if (existingUser) {
      if (existingUser.role !== "admin") {
        console.log(`User ${email} already exists but role is ${existingUser.role}. Updating to admin...`);
        await db.update(usersTable)
          .set({ role: "admin" })
          .where(eq(usersTable.email, email));
        console.log(`User ${email} role updated to admin successfully.`);
        process.exit(0);
      }
      console.log(`User ${email} already exists (Role: ${existingUser.role}). Skipping creation.`);
      process.exit(0);
    }

    console.log("Hashing password...");
    const passwordHash = await bcrypt.hash(password, 10);

    console.log("Creating admin account...");
    const [user] = await db.insert(usersTable).values({
      email,
      passwordHash,
      role: "admin",
    }).returning();

    console.log(`Admin user created successfully: ${user.email} (ID: ${user.id})`);
    process.exit(0);
  } catch (err) {
    console.error("Failed to create admin user:", err);
    process.exit(1);
  }
}

createAdmin();
