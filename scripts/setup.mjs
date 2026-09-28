import { copyFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!existsSync(path.join(root, ".env"))) copyFileSync(path.join(root, ".env.example"), path.join(root, ".env"));
const executable = "npm";
const commandEnvironment = { ...process.env };
if (process.platform === "win32") {
  const engineDirectory = path.join(root, "node_modules", "@prisma", "engines");
  const queryEngine = path.join(engineDirectory, "query_engine-windows.dll.node");
  const schemaEngine = path.join(engineDirectory, "schema-engine-windows.exe");
  if (existsSync(queryEngine)) commandEnvironment.PRISMA_QUERY_ENGINE_LIBRARY = queryEngine;
  if (existsSync(schemaEngine)) commandEnvironment.PRISMA_SCHEMA_ENGINE_BINARY = schemaEngine;
}
const steps = [];
if (!existsSync(path.join(root, "node_modules", ".prisma", "client", "index.js"))) steps.push(["run", "prisma", "--", "generate"]);
steps.push(["run", "db:migrate"], ["run", "db:seed", "--workspace", "@aevrix/api"]);
for (const args of steps) {
  const result = spawnSync(executable, args, { cwd: root, env: commandEnvironment, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("AEVRIX is initialized. Run: npm run dev");
