/**
 * @module cli
 *
 * CLI argument parsing for the `bascik` binary.
 *
 * `resolveCliAction` is a pure function that maps raw argv (minus node/script)
 * to a decision so `src/index.ts` stays a thin shell with no logic of its own,
 * and the parsing behavior can be unit tested without starting a server.
 */

export type CliAction =
  | "init"
  | "check"
  | "prodServer"
  | "build"
  | "dev"
  | "help"
  | "version"
  | "error";

export interface CliDecision {
  action: CliAction;
  /** Flags that were not recognized, when action is "error". */
  unknownFlags?: string[];
}

/** Long-form flags the CLI understands. */
const KNOWN_FLAGS = new Set([
  "--build",
  "--serve",
  "--check",
  "--help",
  "-h",
  "--version",
  "-v",
  "--log",
]);

/** Positional subcommands the CLI understands. */
const KNOWN_SUBCOMMANDS = new Set(["init"]);

export const resolveCliAction = (args: string[]): CliDecision => {
  const unknownFlags = args.filter(
    (a) => a.startsWith("-") && !KNOWN_FLAGS.has(a),
  );

  if (unknownFlags.length > 0) {
    return { action: "error", unknownFlags };
  }
  if (args.includes("--help") || args.includes("-h")) {
    return { action: "help" };
  }
  if (args.includes("--version") || args.includes("-v")) {
    return { action: "version" };
  }
  if (args.includes("init")) {
    return { action: "init" };
  }
  if (args.includes("--check")) {
    return { action: "check" };
  }
  if (args.includes("--serve")) {
    return { action: "prodServer" };
  }
  if (args.includes("--build")) {
    return { action: "build" };
  }
  return { action: "dev" };
};

export const CLI_USAGE = `Usage: bascik [command] [options]

Commands:
  init            Scaffold a new Bascik project in the current directory

Options:
  (no flags)      Start the dev server with watch mode
  --build         Transpile all pages to dist/ (production build)
  --serve         Serve the dist/ folder over HTTP/2 (production preview)
  --check         Validate the project (pages, components, config)
  --log [path]    Write build output to a log file (default: .bascik/build.log)
  -h, --help      Show this help text
  -v, --version   Show the installed Bascik version
`;

/** Known subcommands exported for use in error messages / tests. */
export const CLI_SUBCOMMANDS = KNOWN_SUBCOMMANDS;
