import { createWorkflow as apiCreateWorkflow } from "../api/apiMethods";
import { logger } from "./logger";
import { getErrorMessage } from "../api/errors";
import { resolveNamespaceContext } from "../namespace/namespaceContext";

// Re-export createWorkflow from API methods for backward compatibility
export { apiCreateWorkflow as createWorkflow };

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

  // If no namespaceId provided, resolve from namespace context
  if (!selectedNamespaceId) {
    const nsContext = await resolveNamespaceContext();
    selectedNamespaceId = nsContext!.id;
    logger.success(`Using namespace: ${nsContext!.displayName}`);
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

    try {
      selectedWorkflow = await logger.task("Creating new workflow", async () => {
        return await apiCreateWorkflow(
          workflowName,
          selectedNamespaceId,
          description,
        );
      });
      workflowId = selectedWorkflow.id;
      isNew = true;
      logger.success(`Created workflow: ${selectedWorkflow.name}`);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error(errorMessage);
      throw error;
    }
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

// Backward compatibility alias
export { setupWorkflow as selectOrCreateWorkflow };
