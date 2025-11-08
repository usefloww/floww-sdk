import {
  fetchWorkflows,
  createWorkflow,
  fetchNamespaces,
} from "../api/apiMethods";
import { logger } from "./logger";

export interface WorkflowSelectionOptions {
  namespaceId?: string;
  suggestedName?: string;
  allowCreate?: boolean;
}

export interface WorkflowSelectionResult {
  workflowId: string;
  isNew: boolean;
  workflow: {
    id: string;
    name: string;
    description?: string;
  };
}

/**
 * Interactive workflow selection or creation flow
 * Used by both init and deploy commands when workflow selection is needed
 */
export async function setupWorkflow(
  options: WorkflowSelectionOptions,
): Promise<WorkflowSelectionResult> {
  const { namespaceId, suggestedName, allowCreate = true } = options;

  let selectedNamespaceId = namespaceId;

  // If no namespaceId provided, let user select one
  if (!selectedNamespaceId) {
    const namespaces = await logger.task(
      "Fetching your namespaces",
      async () => {
        return await fetchNamespaces();
      },
    );

    if (namespaces.length === 0) {
      throw new Error(
        "No namespaces found. Please create a namespace in the Floww dashboard first.",
      );
    }

    if (namespaces.length === 1) {
      selectedNamespaceId = namespaces[0].id;
      logger.success(`Using namespace: ${namespaces[0].organization?.display_name || 'Personal'}`);
    } else {
      selectedNamespaceId = await logger.select(
        "Select a namespace:",
        namespaces.map((ns) => ({
          value: ns.id,
          label: ns.organization?.display_name || 'Personal',
          hint: ns.organization?.name || 'personal',
        })),
      );
    }
  }

  let workflowId: string | undefined;
  let selectedWorkflow: any;
  let isNew = false;

  // Create new workflow if needed
  if (!workflowId) {
    if (!allowCreate) {
      throw new Error(
        "No existing workflows found and creation is not allowed",
      );
    }

    let workflowName = suggestedName;
    if (!workflowName) {
      workflowName = await logger.text("Workflow name:", "my-workflow");
      if (!workflowName) {
        throw new Error("Workflow name is required");
      }
      if (workflowName.length < 2) {
        throw new Error("Name must be at least 2 characters");
      }
      if (!/^[a-zA-Z0-9\-_\s]+$/.test(workflowName)) {
        throw new Error(
          "Name can only contain letters, numbers, spaces, hyphens, and underscores",
        );
      }
    }

    let description: string | undefined;
    description = await logger.text("Description (optional):", "", "");
    if (!description) description = undefined;

    selectedWorkflow = await logger.task("Creating new workflow", async () => {
      return await createWorkflow(
        workflowName,
        selectedNamespaceId,
        description,
      );
    });
    workflowId = selectedWorkflow.id;
    isNew = true;
    logger.success(`Created workflow: ${selectedWorkflow.name}`);
  }

  if (!workflowId || !selectedWorkflow) {
    throw new Error("Failed to select or create workflow");
  }

  return {
    workflowId,
    isNew,
    workflow: {
      id: selectedWorkflow.id,
      name: selectedWorkflow.name,
      description: selectedWorkflow.description,
    },
  };
}
