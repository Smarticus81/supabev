import type { Config } from "drizzle-kit";

export default {
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL!,
  },
  // Supabase specific settings
  migrations: {
    table: "__drizzle_migrations",
    schema: "public",
  },
} satisfies Config;
