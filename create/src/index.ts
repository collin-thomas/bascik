#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { scaffold, validateProjectName } from "./scaffold.js";

const nameArg = process.argv[2];

let projectName: string;

if (nameArg) {
  projectName = nameArg;
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("Project name (bascik-app): ");
  rl.close();
  projectName = answer.trim() || "bascik-app";
}

const error = validateProjectName(projectName);
if (error) {
  console.error(`\nError: ${error}\n`);
  process.exit(1);
}

console.log(`\nCreating Bascik project "${projectName}"…\n`);
await scaffold(projectName);
