import inquirer from "inquirer";
import { ApiClient } from "../api/client";

export type SecretDefinition = {
  key: string;
  label: string;
  type: "string" | "password";
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

    // First, list secrets to find the matching one
    const response = await this.apiClient.apiCall<SecretResponse[]>(
      `/secrets/namespace/${this.namespaceId}?provider=${encodeURIComponent(providerType)}&name=${encodeURIComponent(secretName)}`,
    );

    // 404 Not Found is okay - it just means no secrets exist yet
    if (response.error && response.status !== 404) {
      throw new Error(`Failed to get secret: ${response.error}`);
    }

    if (
      !response.data ||
      !Array.isArray(response.data) ||
      response.data.length === 0
    ) {
      return undefined;
    }

    // Get the secret with its decrypted value
    const secret = response.data[0];
    const valueResponse = await this.apiClient.apiCall<SecretWithValueResponse>(
      `/secrets/${secret.id}`,
    );

    return valueResponse.data?.value;
  }

  /**
   * Get all secrets for a provider credential
   */
  async getProviderSecrets(
    providerType: string,
    credentialName: string,
  ): Promise<ProviderSecrets | undefined> {
    // List all secrets for this provider
    const response = await this.apiClient.apiCall<SecretResponse[]>(
      `/secrets/namespace/${this.namespaceId}?provider=${encodeURIComponent(providerType)}`,
    );

    // 404 Not Found is okay - it just means no secrets exist yet
    if (response.error && response.status !== 404) {
      throw new Error(`Failed to get provider secrets: ${response.error}`);
    }

    if (
      !response.data ||
      !Array.isArray(response.data) ||
      response.data.length === 0
    ) {
      return undefined;
    }

    // Filter secrets that match the credential name pattern
    const prefix = `${credentialName}:`;
    const matchingSecrets = response.data.filter((s) =>
      s.name.startsWith(prefix),
    );

    if (matchingSecrets.length === 0) {
      return undefined;
    }

    // Fetch all secret values
    const secrets: ProviderSecrets = {};
    for (const secret of matchingSecrets) {
      const valueResponse =
        await this.apiClient.apiCall<SecretWithValueResponse>(
          `/secrets/${secret.id}`,
        );

      if (valueResponse.data?.value) {
        // Extract the key from the name (remove "credentialName:" prefix)
        const key = secret.name.substring(prefix.length);
        secrets[key] = valueResponse.data.value;
      }
    }

    return Object.keys(secrets).length > 0 ? secrets : undefined;
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

    // Check if secret already exists
    const existing = await this.apiClient.apiCall<SecretResponse[]>(
      `/secrets/namespace/${this.namespaceId}?provider=${encodeURIComponent(providerType)}&name=${encodeURIComponent(secretName)}`,
    );

    // 404 Not Found is okay - it just means no secrets exist yet
    if (existing.error && existing.status !== 404) {
      throw new Error(`Failed to check existing secret: ${existing.error}`);
    }

    if (
      existing.data &&
      Array.isArray(existing.data) &&
      existing.data.length > 0
    ) {
      // Update existing secret
      const updateResponse = await this.apiClient.apiCall(
        `/secrets/${existing.data[0].id}`,
        {
          method: "PATCH",
          body: { value },
        },
      );

      if (updateResponse.error) {
        throw new Error(`Failed to update secret: ${updateResponse.error}`);
      }
    } else {
      // Create new secret
      const createResponse = await this.apiClient.apiCall("/secrets/", {
        method: "POST",
        body: {
          namespace_id: this.namespaceId,
          name: secretName,
          provider: providerType,
          value,
        },
      });

      if (createResponse.error) {
        throw new Error(`Failed to create secret: ${createResponse.error}`);
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
    // Set each secret individually
    for (const [key, value] of Object.entries(secrets)) {
      await this.setSecret(providerType, credentialName, key, value);
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

    const secrets: ProviderSecrets = {};

    // Build inquirer prompts
    const prompts = [];
    for (const def of definitions) {
      const existingValue = await this.getSecret(
        providerType,
        credentialName,
        def.key,
      );

      // Skip if already exists and not required
      if (existingValue && !def.required) {
        secrets[def.key] = existingValue;
        continue;
      }

      prompts.push({
        type: def.type === "password" ? "password" : "input",
        name: def.key,
        message: def.label,
        default: existingValue || undefined,
        validate: (input: string) => {
          if (def.required && !input.trim()) {
            return `${def.label} is required`;
          }
          return true;
        },
        transformer: (input: string) => {
          // Show if existing value is being kept
          if (!input && existingValue) {
            return "(keeping existing value)";
          }
          return input;
        },
      });
    }

    // Prompt user for all secrets
    if (prompts.length > 0) {
      const answers = await inquirer.prompt(prompts);

      // Merge answers with existing secrets
      for (const [key, value] of Object.entries(answers)) {
        if (value) {
          secrets[key] = value as string;
        } else {
          // If no value provided, use existing value
          const existingValue = await this.getSecret(
            providerType,
            credentialName,
            key,
          );
          if (existingValue) {
            secrets[key] = existingValue;
          }
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
    // List all secrets for this provider and credential
    const response = await this.apiClient.apiCall<SecretResponse[]>(
      `/secrets/namespace/${this.namespaceId}?provider=${encodeURIComponent(providerType)}`,
    );

    if (!response.data || response.data.length === 0) {
      return;
    }

    // Filter secrets that match the credential name pattern
    const prefix = `${credentialName}:`;
    const matchingSecrets = response.data.filter((s) =>
      s.name.startsWith(prefix),
    );

    // Delete each matching secret
    for (const secret of matchingSecrets) {
      await this.apiClient.apiCall(`/secrets/${secret.id}`, {
        method: "DELETE",
      });
    }
  }

  /**
   * Clear all secrets in the namespace
   */
  async clearAllSecrets(): Promise<void> {
    // List all secrets in the namespace
    const response = await this.apiClient.apiCall<SecretResponse[]>(
      `/secrets/namespace/${this.namespaceId}`,
    );

    if (!response.data || response.data.length === 0) {
      return;
    }

    // Delete each secret
    for (const secret of response.data) {
      await this.apiClient.apiCall(`/secrets/${secret.id}`, {
        method: "DELETE",
      });
    }
  }
}
