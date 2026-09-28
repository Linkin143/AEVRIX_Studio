import fs from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "../config/env.js";

export async function saveReplicateToken(token: string) {
  const envPath = path.join(repoRoot, ".env");
  let content = await fs.readFile(envPath, "utf8").catch(() => "");
  const line = `REPLICATE_API_TOKEN=${token}`;
  content = /^REPLICATE_API_TOKEN=.*$/m.test(content) ? content.replace(/^REPLICATE_API_TOKEN=.*$/m, line) : `${content.trimEnd()}${content ? "\n" : ""}${line}\n`;
  const temporary = `${envPath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, content, { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporary, envPath);
}
