#!/usr/bin/env node

const args = process.argv.slice(2);

if (args.includes("init")) {
  const { initProject } = await import("./lib/init.js");
  console.log("\nInitializing Bascik project…\n");
  await initProject();
  process.exit(0);
}

if (args.includes("--check")) {
  const { checkProject } = await import("./lib/check.js");
  const ok = await checkProject();
  process.exit(ok ? 0 : 1);
}

if (args.includes("--serve")) {
  const { createSelfSignedCert } = await import("./lib/pki.js");
  await createSelfSignedCert();
  const { serveProduction } = await import("./lib/serve.js");
  await serveProduction();
} else {
  await import("./transpile.js");
}
