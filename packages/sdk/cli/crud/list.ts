import {
  fetchWorkflows,
  fetchNamespaces,
  listWorkflowDeployments,
  fetchProviders,
  type Workflow,
  type Namespace,
  type WorkflowDeploymentResponse,
  type Provider,
} from "../api/apiMethods";
import Table from "cli-table3";
import chalk from "chalk";
import logSymbols from "log-symbols";
import { resolveNamespaceContext } from "../namespace/namespaceContext";

function formatDate(dateString?: string): string {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

export async function listWorkflowsCommand(json: boolean = false) {
  try {
    const namespace = await resolveNamespaceContext();
    const workflows = await fetchWorkflows(namespace!.id);

    if (json) {
      console.log(JSON.stringify(workflows, null, 2));
      return;
    }

    console.log(`\n${chalk.bold("Namespace:")} ${chalk.cyan(namespace!.displayName)}`);

    if (workflows.length === 0) {
      console.log(
        `\n${logSymbols.warning} ${chalk.yellow("No workflows found")}`,
      );
      return;
    }

    const table = new Table({
      head: [
        chalk.gray("NAME"),
        chalk.gray("ID"),
        chalk.gray("CREATED"),
        chalk.gray("DESCRIPTION"),
      ],
      style: {
        head: [],
        border: [],
      },
      chars: {
        top: "",
        "top-mid": "",
        "top-left": "",
        "top-right": "",
        bottom: "",
        "bottom-mid": "",
        "bottom-left": "",
        "bottom-right": "",
        left: "",
        "left-mid": "",
        mid: "",
        "mid-mid": "",
        right: "",
        "right-mid": "",
        middle: " ",
      },
    });

    workflows.forEach((workflow: Workflow) => {
      table.push([
        chalk.white(workflow.name),
        chalk.dim(workflow.id),
        chalk.green(formatDate(workflow.createdAt)),
        chalk.dim(truncateText(workflow.description || "", 50)),
      ]);
    });

    console.log("\n" + table.toString());
  } catch (error) {
    throw error;
  }
}

export async function listNamespacesCommand(json: boolean = false) {
  try {
    if (!json) {
      console.log(`${logSymbols.info} ${chalk.blue("Fetching namespaces...")}`);
    }
    const namespaces = await fetchNamespaces();

    if (json) {
      console.log(JSON.stringify(namespaces, null, 2));
      return;
    }

    // Get current namespace context (don't require it)
    const currentNs = await resolveNamespaceContext({ required: false });

    if (namespaces.length === 0) {
      console.log(
        `\n${logSymbols.warning} ${chalk.yellow("No namespaces found")}`,
      );
      return;
    }

    const table = new Table({
      head: [
        chalk.gray("NAME"),
        chalk.gray("DISPLAY NAME"),
        chalk.gray("ID"),
        chalk.gray("OWNER"),
      ],
      style: {
        head: [],
        border: [],
      },
      chars: {
        top: "",
        "top-mid": "",
        "top-left": "",
        "top-right": "",
        bottom: "",
        "bottom-mid": "",
        "bottom-left": "",
        "bottom-right": "",
        left: "",
        "left-mid": "",
        mid: "",
        "mid-mid": "",
        right: "",
        "right-mid": "",
        middle: " ",
      },
    });

    namespaces.forEach((namespace: Namespace) => {
      const owner = namespace.organization
        ? chalk.magenta(`org:${namespace.organization.id.substring(0, 8)}`)
        : namespace.user
          ? chalk.blue(`user:${namespace.user.id.substring(0, 8)}`)
          : chalk.dim("unknown");

      const isCurrent = currentNs?.id === namespace.id;
      const displayName = namespace.organization?.displayName || 'Personal';
      const nameLabel = isCurrent
        ? chalk.white(displayName) + chalk.green(" (current)")
        : chalk.white(displayName);

      table.push([
        nameLabel,
        chalk.cyan(displayName),
        chalk.dim(namespace.id.substring(0, 8)),
        owner,
      ]);
    });

    console.log("\n" + table.toString());
  } catch (error) {
    console.error(
      `${logSymbols.error} ${chalk.red("Failed to fetch namespaces:")} ${error}`,
    );
    process.exit(1);
  }
}

function formatStatus(status: string): string {
  switch (status.toLowerCase()) {
    case "active":
      return chalk.green("Active");
    case "inactive":
      return chalk.yellow("Inactive");
    case "failed":
      return chalk.red("Failed");
    default:
      return chalk.dim(status);
  }
}

export async function listDeploymentsCommand(workflowId?: string, json: boolean = false) {
  try {
    const namespace = await resolveNamespaceContext();

    if (!json) {
      console.log(`\n${chalk.bold("Namespace:")} ${chalk.cyan(namespace!.displayName)}`);
      console.log(`${logSymbols.info} ${chalk.blue("Fetching deployments...")}`);
    }
    const deployments = await listWorkflowDeployments(workflowId);

    if (json) {
      console.log(JSON.stringify(deployments, null, 2));
      return;
    }

    if (deployments.length === 0) {
      const message = workflowId
        ? `No deployments found for workflow ${workflowId}`
        : "No deployments found";
      console.log(`\n${logSymbols.warning} ${chalk.yellow(message)}`);
      return;
    }

    const table = new Table({
      head: [
        chalk.gray("WORKFLOW"),
        chalk.gray("RUNTIME"),
        chalk.gray("STATUS"),
        chalk.gray("DEPLOYED"),
        chalk.gray("DEPLOYMENT ID"),
      ],
      style: {
        head: [],
        border: [],
      },
      chars: {
        top: "",
        "top-mid": "",
        "top-left": "",
        "top-right": "",
        bottom: "",
        "bottom-mid": "",
        "bottom-left": "",
        "bottom-right": "",
        left: "",
        "left-mid": "",
        mid: "",
        "mid-mid": "",
        right: "",
        "right-mid": "",
        middle: " ",
      },
    });

    deployments.forEach((deployment: WorkflowDeploymentResponse) => {
      table.push([
        chalk.white(
          deployment.workflowName || truncateText(deployment.workflowId, 12),
        ),
        chalk.cyan(
          deployment.runtimeName || truncateText(deployment.runtimeId, 12),
        ),
        formatStatus(deployment.status),
        chalk.green(formatDate(deployment.deployedAt)),
        chalk.dim(deployment.id.substring(0, 8)),
      ]);
    });

    console.log("\n" + table.toString());

    // Show summary info
    const activeCount = deployments.filter(
      (d) => d.status.toLowerCase() === "active",
    ).length;
    const totalCount = deployments.length;
    console.log(
      `\n${chalk.dim(`Total: ${totalCount} deployments, ${activeCount} active`)}`,
    );
  } catch (error) {
    console.error(
      `${logSymbols.error} ${chalk.red("Failed to fetch deployments:")} ${error}`,
    );
    process.exit(1);
  }
}

export async function listProvidersCommand(json: boolean = false) {
  try {
    const namespace = await resolveNamespaceContext();
    const providers = await fetchProviders(namespace!.id);

    if (json) {
      console.log(JSON.stringify(providers, null, 2));
      return;
    }

    console.log(`\n${chalk.bold("Namespace:")} ${chalk.cyan(namespace!.displayName)}`);

    if (providers.length === 0) {
      console.log(
        `\n${logSymbols.warning} ${chalk.yellow("No providers found")}`,
      );
      return;
    }

    const table = new Table({
      head: [
        chalk.gray("ALIAS"),
        chalk.gray("TYPE"),
        chalk.gray("ID"),
      ],
      style: {
        head: [],
        border: [],
      },
      chars: {
        top: "",
        "top-mid": "",
        "top-left": "",
        "top-right": "",
        bottom: "",
        "bottom-mid": "",
        "bottom-left": "",
        "bottom-right": "",
        left: "",
        "left-mid": "",
        mid: "",
        "mid-mid": "",
        right: "",
        "right-mid": "",
        middle: " ",
      },
    });

    providers.forEach((provider: Provider) => {
      table.push([
        chalk.white(provider.alias),
        chalk.cyan(provider.type),
        chalk.dim(provider.id.substring(0, 8)),
      ]);
    });

    console.log("\n" + table.toString());
    console.log(`\n${chalk.dim(`Total: ${providers.length} providers`)}`);
  } catch (error) {
    throw error;
  }
}
