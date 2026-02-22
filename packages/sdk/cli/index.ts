#!/usr/bin/env node
import { createRequire } from "node:module";
import { Command } from "commander";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };
import { devCommand } from "./commands/dev";
import { loginCommand, logoutCommand, whoamiCommand } from "./commands/auth";
import {
  configSetCommand,
  configGetCommand,
  configListCommand,
  configResetCommand,
  configHelpCommand,
} from "./commands/config";
import { setConfig } from "./config/configUtils";
import { deployCommand } from "./commands/deploy";
import { initCommand } from "./commands/init";
import { pullCommand } from "./commands/pull";
import {
  listWorkflowsCommand,
  listNamespacesCommand,
  listDeploymentsCommand,
  listProvidersCommand,
} from "./crud/list";
import { manageProviders } from "./providers/index";
import {
  namespaceShowCommand,
  namespaceSelectCommand,
  namespaceSetCommand,
} from "./commands/namespace";
import {
  ClientError,
  UnauthenticatedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  NetworkError,
  ApiError,
} from "./api/errors";
import { NamespaceNotSetError } from "./namespace/namespaceContext";

const program = new Command();

program
  .name("floww")
  .description("CLI for running trigger-based workflows")
  .version(pkg.version)
  .option("--backend-url <url>", "Backend API URL")
  .option("--workos-client-id <id>", "WorkOS client ID")
  .option("--registry-url <url>", "Docker registry URL");

program
  .command("init")
  .description("Initialize a new Floww project")
  .option("--force", "Overwrite existing floww.json")
  .option("--name <name>", "Workflow name")
  .option("--namespace <id>", "Namespace ID")
  .option("--description <desc>", "Workflow description")
  .action(async (options) => {
    await initCommand(options);
  });

program
  .command("dev")
  .description("Run triggers in development mode with auto-reload")
  .argument(
    "[file]",
    "Path to the triggers file (defaults to entrypoint from floww.yaml)"
  )
  .option("-p, --port <port>", "Port for webhook server", "3000")
  .option("-h, --host <host>", "Host for webhook server", "localhost")
  .option(
    "--debug",
    "Enable debugging mode with enhanced logging and inspector"
  )
  .option(
    "--debug-port <port>",
    "Inspector port for debugging (default: 9229)",
    "9229"
  )
  .action(devCommand);

program
  .command("deploy")
  .description(
    "Deploy triggers to the server (uses entrypoint from floww.yaml)"
  )
  .action(deployCommand);

program
  .command("pull [workflow]")
  .description("Pull an existing workflow's deployed source code")
  .option("-o, --output-dir <dir>", "Output directory (default: cwd)")
  .option("--json", "JSON output")
  .action(async (workflow, options) => {
    await pullCommand(workflow, options);
  });

program.command("login").description("Login to Floww").action(loginCommand);

program.command("logout").description("Logout").action(logoutCommand);

program
  .command("whoami")
  .description("Show the current user")
  .action(whoamiCommand);

// Config commands
const configCmd = program.command("config").description("Manage configuration");

configCmd
  .command("set <key> <value>")
  .description("Set a configuration value")
  .action(configSetCommand);

configCmd
  .command("get <key>")
  .description("Get a configuration value")
  .action(configGetCommand);

configCmd
  .command("list")
  .description("List all configuration values")
  .action(configListCommand);

configCmd
  .command("reset")
  .description("Reset configuration to defaults")
  .action(configResetCommand);

configCmd
  .command("help")
  .description("Show configuration help")
  .action(configHelpCommand);

// List commands
const listCmd = program.command("list").description("List resources");

listCmd
  .command("workflows")
  .description("List all workflows")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    await listWorkflowsCommand(options.json);
  });

listCmd
  .command("namespaces")
  .description("List all namespaces")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    await listNamespacesCommand(options.json);
  });

listCmd
  .command("deployments")
  .description("List workflow deployments")
  .option("-w, --workflow <id>", "Filter by workflow ID")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    await listDeploymentsCommand(options.workflow, options.json);
  });

listCmd
  .command("providers")
  .description("List all providers")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    await listProvidersCommand(options.json);
  });

// Provider management commands
// program
//   .command('manage')
//   .description('Manage resources');

program
  .command("manage providers")
  .description("Manage providers interactively")
  .action(async () => {
    await manageProviders();
  });

// Namespace commands
const nsCmd = program
  .command("namespace")
  .alias("ns")
  .description("Manage namespace context");

nsCmd
  .command("show", { isDefault: true })
  .description("Show current namespace context")
  .action(namespaceShowCommand);

nsCmd
  .command("select")
  .description("Interactively select a namespace")
  .action(namespaceSelectCommand);

nsCmd
  .command("set <id>")
  .description("Set namespace by ID")
  .action(namespaceSetCommand);

// Initialize config with CLI options before parsing commands
program.hook("preAction", (thisCommand) => {
  const opts = thisCommand.optsWithGlobals();
  const cliOptions: any = {};

  if (opts.backendUrl) cliOptions.backendUrl = opts.backendUrl;
  if (opts.workosClientId) cliOptions.workosClientId = opts.workosClientId;
  if (opts.registryUrl) cliOptions.registryUrl = opts.registryUrl;

  setConfig(cliOptions);
});

// Global error handler for ClientError
async function main() {
  try {
    await program.parseAsync();
  } catch (error) {
    if (error instanceof NamespaceNotSetError) {
      console.error(`\n${error.message}\n`);
      process.exit(1);
    }

    if (error instanceof ClientError) {
      // Handle our custom API errors with user-friendly messages
      if (error instanceof UnauthenticatedError) {
        console.error(`\n❌ ${error.message}\n`);
      } else if (error instanceof ForbiddenError) {
        console.error(`\n❌ Access denied: ${error.message}\n`);
      } else if (error instanceof NotFoundError) {
        console.error(`\n❌ Not found: ${error.message}\n`);
      } else if (error instanceof ConflictError) {
        console.error(`\n❌ Conflict: ${error.message}\n`);
      } else if (error instanceof NetworkError) {
        console.error(`\n❌ Network error: ${error.message}\n`);
        console.error("Please check your internet connection and try again.\n");
      } else if (error instanceof ApiError) {
        console.error(
          `\n❌ API error (${error.statusCode}): ${error.message}\n`
        );
      } else {
        console.error(`\n❌ Error: ${error.message}\n`);
      }

      // Show debug info if available
      if (process.env.DEBUG && error.details) {
        console.error("Debug details:", JSON.stringify(error.details, null, 2));
      }

      process.exit(1);
    }

    // Re-throw other errors
    throw error;
  }
}

main().catch((error) => {
  console.error("\n❌ Unexpected error:", error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});
