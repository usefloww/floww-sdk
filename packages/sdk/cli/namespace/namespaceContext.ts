import {
  loadActiveProfile,
  updateProfileNamespace,
  type ProfileNamespace,
} from "../auth/authUtils";
import { fetchNamespaces } from "../api/apiMethods";
import { logger } from "../utils/logger";

export class NamespaceNotSetError extends Error {
  constructor() {
    super(
      "No namespace selected. Set one with:\n" +
        "  floww namespace select    Interactive picker\n" +
        "  floww namespace set <id>  Set by ID\n" +
        "  FLOWW_NAMESPACE=<id>      Environment variable"
    );
    this.name = "NamespaceNotSetError";
  }
}

export interface NamespaceContext {
  id: string;
  displayName: string;
  source: "env" | "profile" | "auto";
}

export interface ResolveOptions {
  required?: boolean;
}

export async function resolveNamespaceContext(
  options: ResolveOptions = {}
): Promise<NamespaceContext | null> {
  const { required = true } = options;

  // 1. FLOWW_NAMESPACE env var
  const envNamespace = process.env.FLOWW_NAMESPACE;
  if (envNamespace) {
    return {
      id: envNamespace,
      displayName: envNamespace,
      source: "env",
    };
  }

  // 2. Profile's stored namespace field
  const profile = loadActiveProfile();
  if (profile?.namespace) {
    return {
      id: profile.namespace.id,
      displayName: profile.namespace.displayName,
      source: "profile",
    };
  }

  // 3. Auto-resolve: if exactly 1 namespace, use it
  try {
    const namespaces = await fetchNamespaces();
    if (namespaces.length === 1) {
      const ns = namespaces[0];
      const resolved: ProfileNamespace = {
        id: ns.id,
        displayName: ns.organization?.displayName || "Personal",
      };

      // Persist to profile if available
      if (profile) {
        updateProfileNamespace(resolved);
      }

      return {
        id: resolved.id,
        displayName: resolved.displayName,
        source: "auto",
      };
    }
  } catch {
    // If we can't fetch namespaces, fall through
  }

  // 4. Nothing resolved
  if (required) {
    throw new NamespaceNotSetError();
  }

  return null;
}

export async function selectNamespaceInteractive(): Promise<ProfileNamespace | null> {
  const namespaces = await fetchNamespaces();

  if (namespaces.length === 0) {
    return null;
  }

  let selected: ProfileNamespace;

  if (namespaces.length === 1) {
    selected = {
      id: namespaces[0].id,
      displayName: namespaces[0].organization?.displayName || "Personal",
    };
    logger.success(`Namespace: ${selected.displayName}`);
  } else {
    const selectedId = await logger.select(
      "Select a namespace:",
      namespaces.map((ns) => ({
        value: ns.id,
        label: ns.organization?.displayName || "Personal",
      }))
    );
    const ns = namespaces.find((n) => n.id === selectedId)!;
    selected = {
      id: ns.id,
      displayName: ns.organization?.displayName || "Personal",
    };
  }

  updateProfileNamespace(selected);
  return selected;
}
