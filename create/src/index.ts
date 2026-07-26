#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { scaffold, validateProjectName } from "./scaffold.js";

const nameArg = process.argv[2];

const rl = createInterface({ input: process.stdin, output: process.stdout });

let projectName: string;

if (nameArg) {
  projectName = nameArg;
} else {
  const answer = await rl.question("Project name (bascik-app): ");
  projectName = answer.trim() || "bascik-app";
}

const error = validateProjectName(projectName);
if (error) {
  rl.close();
  console.error(`\nError: ${error}\n`);
  process.exit(1);
}

console.log(`\nCreating Bascik project "${projectName}"…\n`);
await scaffold(projectName);
console.log(`✓ Scaffolded ${projectName}/\n`);

const installAnswer = await rl.question("Install dependencies now? (Y/n) ");
const shouldInstall = installAnswer.trim().toLowerCase() !== "n";

let shouldDev = false;
if (shouldInstall) {
  const devAnswer = await rl.question("Start the dev server after install? (Y/n) ");
  shouldDev = devAnswer.trim().toLowerCase() !== "n";
}

rl.close();

const projectDir = join(process.cwd(), projectName);

if (shouldInstall) {
  console.log("\nInstalling dependencies…\n");
  spawnSync("npm", ["install"], { cwd: projectDir, stdio: "inherit", shell: true });
}

if (shouldDev) {
  console.log("\nStarting dev server…\n");
  spawnSync("npm", ["run", "dev"], { cwd: projectDir, stdio: "inherit", shell: true });
} else {
  console.log("\nNext steps:\n");
  if (!shouldInstall) console.log(`  cd ${projectName}`);
  if (!shouldInstall) console.log("  npm install");
  console.log("  npm run dev\n");
}
