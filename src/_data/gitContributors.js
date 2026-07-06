import { execSync } from "node:child_process";

export default function () {
  try {
    const output = execSync("git log --format=%aN", { encoding: "utf8" });
    return [...new Set(output.split(/\r?\n/).map((name) => name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}
