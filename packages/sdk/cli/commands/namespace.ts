import chalk from "chalk";
import {
  resolveNamespaceContext,
  selectNamespaceInteractive,
} from "../namespace/namespaceContext";
import {
  updateProfileNamespace,
} from "../auth/authUtils";
import type { ProfileNamespace } from "../auth/authUtils";
import { fetchNamespaces } from "../api/apiMethods";
import { logger } from "../utils/logger";

export async function namespaceShowCommand() {
  const context = await resolveNamespaceContext({ required: false });

  if (!context) {
    console.log(
      `\n${chalk.yellow("No namespace selected.")}\n`
    );
    console.log(`Set one with:`);
    console.log(`  ${chalk.cyan("floww namespace select")}    Interactive picker`);
    console.log(`  ${chalk.cyan("floww namespace set <id>")}  Set by ID`);
    console.log(`  ${chalk.cyan("FLOWW_NAMESPACE=<id>")}      Environment variable\n`);
    return;
  }

  console.log(`\n${chalk.bold("Namespace:")} ${chalk.white(context.displayName)}`);
  console.log(`${chalk.bold("ID:")}        ${chalk.dim(context.id)}`);
  console.log(`${chalk.bold("Source:")}    ${chalk.dim(context.source)}\n`);
}

export async function namespaceSelectCommand() {
  const selected = await selectNamespaceInteractive();

  if (!selected) {
    logger.warn("No namespaces available.");
    return;
  }

  logger.success(`Namespace set to ${selected.displayName}`);
}

export async function namespaceSetCommand(id: string) {
  // Validate against API
  const namespaces = await fetchNamespaces();
  const match = namespaces.find((ns) => ns.id === id);

  if (!match) {
    logger.error(`Namespace not found: ${id}`);
    process.exit(1);
  }

  const ns: ProfileNamespace = {
    id: match.id,
    displayName: match.organization?.displayName || "Personal",
  };

  updateProfileNamespace(ns);
  logger.success(`Namespace set to ${ns.displayName}`);
}
