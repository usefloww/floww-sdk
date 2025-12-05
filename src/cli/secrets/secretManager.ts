import inquirer from "inquirer";
import { ApiClient } from "../api/types";
import { NotFoundError } from "../api/errors";

export type SecretDefinition = {
  key: string;
  label: string;
  type: "string" | "password";
  dataType: "string" | "number" | "boolean";
  required: boolean;
};

export type ProviderSecrets = Record<string, string>;

// Backend API response types
interface SecretResponse {
  id: string;
  namespace_id: string;
  name: string;
  provider: string;
  created_at: string;
  updated_at: string;
}

interface SecretWithValueResponse extends SecretResponse {
  value: string;
}

export class SecretManager {
  private apiClient: ApiClient;
  private namespaceId: string;

  constructor(apiClient: ApiClient, namespaceId: string) {
    this.apiClient = apiClient;
    this.namespaceId = namespaceId;
  }

  /**
   * Get a specific secret value from the backend
   */
  async getSecret(
    providerType: string,
    credentialName: string,
    key: string,
  ): Promise<string | undefined> {
    const secretName = `${credentialName}:${key}`;

    try {
      // First, list secrets to find the matching one
      const secrets = await this.apiClient.apiCall<SecretResponse[]>(
        `/secrets/namespace/${this.namespaceId}?provider=${encodeURIComponent(providerType)}&name=${encodeURIComponent(secretName)}`,
      );

      if (!Array.isArray(secrets) || secrets.length === 0) {
        return undefined;
      }

      // Get the secret with its decrypted value
      const secret = secrets[0];
      const secretWithValue =
        await this.apiClient.apiCall<SecretWithValueResponse>(
          `/secrets/${secret.id}`,
        );

      return secretWithValue?.value;
    } catch (error) {
      // 404 Not Found is okay - it just means no secrets exist yet
      if (error instanceof NotFoundError) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Get all secrets for a provider credential
   */
  async getProviderSecrets(
    providerType: string,
    credentialName: string,
  ): Promise<ProviderSecrets | undefined> {
    try {
      // List all secrets for this provider
      const allSecrets = await this.apiClient.apiCall<SecretResponse[]>(
        `/secrets/namespace/${this.namespaceId}?provider=${encodeURIComponent(providerType)}&name=${encodeURIComponent(credentialName)}`,
      );

      if (!Array.isArray(allSecrets) || allSecrets.length === 0) {
        return undefined;
      }

      // Get the secret with its decrypted value
      const secret = allSecrets[0];
      const secretWithValue =
        await this.apiClient.apiCall<SecretWithValueResponse>(
          `/secrets/${secret.id}`,
        );

      if (!secretWithValue?.value) {
        return undefined;
      }

      // Parse JSON value
      try {
        return JSON.parse(secretWithValue.value);
      } catch (error) {
        console.error(`Failed to parse secret JSON for ${providerType}:${credentialName}`, error);
        return undefined;
      }
    } catch (error) {
      // 404 Not Found is okay - it just means no secrets exist yet
      if (error instanceof NotFoundError) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Set a specific secret value in the backend
   */
  async setSecret(
    providerType: string,
    credentialName: string,
    key: string,
    value: string,
  ): Promise<void> {
    const secretName = `${credentialName}:${key}`;

    try {
      // Check if secret already exists
      const existing = await this.apiClient.apiCall<SecretResponse[]>(
        `/secrets/namespace/${this.namespaceId}?provider=${encodeURIComponent(providerType)}&name=${encodeURIComponent(secretName)}`,
      );

      if (Array.isArray(existing) && existing.length > 0) {
        // Update existing secret
        await this.apiClient.apiCall(`/secrets/${existing[0].id}`, {
          method: "PATCH",
          body: { value },
        });
      } else {
        // Create new secret
        await this.apiClient.apiCall("/secrets/", {
          method: "POST",
          body: {
            namespace_id: this.namespaceId,
            name: secretName,
            provider: providerType,
            value,
          },
        });
      }
    } catch (error) {
      // 404 Not Found means no secrets exist, so create new
      if (error instanceof NotFoundError) {
        await this.apiClient.apiCall("/secrets/", {
          method: "POST",
          body: {
            namespace_id: this.namespaceId,
            name: secretName,
            provider: providerType,
            value,
          },
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Set all secrets for a provider credential
   */
  async setProviderSecrets(
    providerType: string,
    credentialName: string,
    secrets: ProviderSecrets,
  ): Promise<void> {
    console.log(`[SecretManager] Storing secrets for ${providerType}:${credentialName}:`, secrets);
    const jsonValue = JSON.stringify(secrets);
    console.log(`[SecretManager] JSON value:`, jsonValue);

    try {
      // Check if secret already exists
      const existing = await this.apiClient.apiCall<SecretResponse[]>(
        `/secrets/namespace/${this.namespaceId}?provider=${encodeURIComponent(providerType)}&name=${encodeURIComponent(credentialName)}`,
      );

      if (Array.isArray(existing) && existing.length > 0) {
        // Update existing secret
        await this.apiClient.apiCall(`/secrets/${existing[0].id}`, {
          method: "PATCH",
          body: { value: jsonValue },
        });
      } else {
        // Create new secret
        await this.apiClient.apiCall("/secrets/", {
          method: "POST",
          body: {
            namespace_id: this.namespaceId,
            name: credentialName,
            provider: providerType,
            value: jsonValue,
          },
        });
      }
    } catch (error) {
      // 404 Not Found means no secrets exist, so create new
      if (error instanceof NotFoundError) {
        await this.apiClient.apiCall("/secrets/", {
          method: "POST",
          body: {
            namespace_id: this.namespaceId,
            name: credentialName,
            provider: providerType,
            value: jsonValue,
          },
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Check if provider has all required secrets
   */
  async hasProviderSecrets(
    providerType: string,
    credentialName: string,
    requiredKeys: string[],
  ): Promise<boolean> {
    const providerSecrets = await this.getProviderSecrets(
      providerType,
      credentialName,
    );
    if (!providerSecrets) return false;

    return requiredKeys.every(
      (key) => providerSecrets[key] && providerSecrets[key].length > 0,
    );
  }

  /**
   * Ensure provider has all required secrets, prompting if necessary
   */
  async ensureProviderSecrets(
    providerType: string,
    credentialName: string,
    definitions: SecretDefinition[],
  ): Promise<ProviderSecrets> {
    const requiredKeys = definitions.map((d) => d.key);
    const hasSecrets = await this.hasProviderSecrets(
      providerType,
      credentialName,
      requiredKeys,
    );

    if (!hasSecrets) {
      // Trigger interactive setup
      return await this.promptForSecrets(
        providerType,
        credentialName,
        definitions,
      );
    }

    // Load existing secrets
    return (await this.getProviderSecrets(providerType, credentialName)) || {};
  }

  /**
   * Interactively prompt for secrets
   */
  async promptForSecrets(
    providerType: string,
    credentialName: string,
    definitions: SecretDefinition[],
  ): Promise<ProviderSecrets> {
    // Clear screen and show header
    console.clear();
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`   🔐 Credential Setup: ${providerType}`);
    console.log("═══════════════════════════════════════════════════════════");
    console.log();
    console.log(`Setting up credential: "${credentialName}"`);
    console.log();

    // Get existing secrets as JSON object
    const existingSecrets = await this.getProviderSecrets(providerType, credentialName) || {};
    const secrets: Record<string, any> = {};

    // Build inquirer prompts
    const prompts: any[] = [];
    for (const def of definitions) {
      console.log(`[Prompt Debug] Field: ${def.key}, dataType: ${def.dataType}, type: ${def.type}`);
      const existingValue = existingSecrets[def.key];

      // Skip if already exists and not required
      if (existingValue !== undefined && !def.required) {
        secrets[def.key] = existingValue;
        continue;
      }

      prompts.push({
        type: def.type === "password" ? "password" : "input",
        name: def.key,
        message: def.label,
        default: existingValue !== undefined ? String(existingValue) : undefined,
        validate: (input: string) => {
          if (def.required && !input.trim()) {
            return `${def.label} is required`;
          }

          // Validate based on dataType
          if (input.trim()) {
            if (def.dataType === 'number') {
              const num = Number(input);
              if (isNaN(num)) {
                return `${def.label} must be a valid number`;
              }
            } else if (def.dataType === 'boolean') {
              if (!['true', 'false', '1', '0'].includes(input.toLowerCase())) {
                return `${def.label} must be true/false or 1/0`;
              }
            }
          }

          return true;
        },
        transformer: (input: string) => {
          // Show if existing value is being kept
          if (!input && existingValue !== undefined) {
            return "(keeping existing value)";
          }
          return input;
        },
      });
    }

    // Prompt user for all secrets
    if (prompts.length > 0) {
      const answers = await inquirer.prompt(prompts);
      console.log(`[Prompt Debug] Raw answers:`, answers);

      // Merge answers with existing secrets, coercing types
      for (const def of definitions) {
        const value = answers[def.key];
        console.log(`[Coercion Debug] ${def.key}: value="${value}", dataType=${def.dataType}`);

        if (value) {
          // Coerce based on dataType
          if (def.dataType === 'number') {
            const coerced = Number(value);
            console.log(`[Coercion Debug] Coercing "${value}" to number: ${coerced}`);
            secrets[def.key] = coerced;
          } else if (def.dataType === 'boolean') {
            secrets[def.key] = value.toLowerCase() === 'true' || value === '1';
          } else {
            secrets[def.key] = value as string;
          }
        } else if (existingSecrets[def.key] !== undefined) {
          // Use existing value if no new value provided
          secrets[def.key] = existingSecrets[def.key];
        }
      }
    }

    // Save the secrets to backend
    await this.setProviderSecrets(providerType, credentialName, secrets);

    console.log();
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`   ✅ Credential "${credentialName}" saved successfully!`);
    console.log("═══════════════════════════════════════════════════════════");
    console.log();

    return secrets;
  }

  /**
   * Clear all secrets for a provider credential
   */
  async clearProviderSecrets(
    providerType: string,
    credentialName: string,
  ): Promise<void> {
    try {
      // List all secrets for this provider and credential
      const allSecrets = await this.apiClient.apiCall<SecretResponse[]>(
        `/secrets/namespace/${this.namespaceId}?provider=${encodeURIComponent(providerType)}&name=${encodeURIComponent(credentialName)}`,
      );

      if (!Array.isArray(allSecrets) || allSecrets.length === 0) {
        return;
      }

      // Delete the secret
      const secret = allSecrets[0];
      await this.apiClient.apiCall(`/secrets/${secret.id}`, {
        method: "DELETE",
      });
    } catch (error) {
      // 404 Not Found is okay - it just means no secrets exist
      if (error instanceof NotFoundError) {
        return;
      }
      throw error;
    }
  }

  /**
   * Clear all secrets in the namespace
   */
  async clearAllSecrets(): Promise<void> {
    try {
      // List all secrets in the namespace
      const allSecrets = await this.apiClient.apiCall<SecretResponse[]>(
        `/secrets/namespace/${this.namespaceId}`,
      );

      if (!Array.isArray(allSecrets) || allSecrets.length === 0) {
        return;
      }

      // Delete each secret
      for (const secret of allSecrets) {
        await this.apiClient.apiCall(`/secrets/${secret.id}`, {
          method: "DELETE",
        });
      }
    } catch (error) {
      // 404 Not Found is okay - it just means no secrets exist
      if (error instanceof NotFoundError) {
        return;
      }
      throw error;
    }
  }
}
