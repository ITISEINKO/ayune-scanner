import { defineConfig } from "drizzle-kit";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

if (existsSync(".env")) loadEnvFile(".env");

export default defineConfig({
	dialect: "turso",
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dbCredentials: {
		url: process.env.TURSO_DATABASE_URL ?? "file:trackerprod-panel.db",
		authToken: process.env.TURSO_AUTH_TOKEN,
	},
});
