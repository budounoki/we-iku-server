import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  // photo-schema も含める。含めないと db:push が写真テーブルを「不明なテーブル」と
  // みなして削除を提案し、写真データを失うおそれがある。
  schema: ["./shared/schema.ts", "./shared/photo-schema.ts"],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
