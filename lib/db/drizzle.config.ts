import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL is not set. Drizzle-kit might fail if it needs a connection.");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});