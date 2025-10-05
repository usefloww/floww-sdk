import * as readline from 'readline';
import { ApiClient } from '../api/client';

export type SecretDefinition = {
  key: string;
  label: string;
  type: 'string' | 'password';
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
  async getSecret(providerType: string, credentialName: string, key: string): Promise<string | undefined> {
    const secretName = `${credentialName}:${key}`;

    // First, list secrets to find the matching one
    const response = await this.apiClient.apiCall<SecretResponse[]>(
      `/secrets/namespace/${this.namespaceId}?provider=${encodeURIComponent(providerType)}&name=${encodeURIComponent(secretName)}`
    );

    if (!response.data || response.data.length === 0) {
      return undefined;
    }

    // Get the secret with its decrypted value
    const secret = response.data[0];
    const valueResponse = await this.apiClient.apiCall<SecretWithValueResponse>(
      `/secrets/${secret.id}`
    );

    return valueResponse.data?.value;
  }

  /**
   * Get all secrets for a provider credential
   */
  async getProviderSecrets(providerType: string, credentialName: string): Promise<ProviderSecrets | undefined> {
    // List all secrets for this provider
    const response = await this.apiClient.apiCall<SecretResponse[]>(
      `/secrets/namespace/${this.namespaceId}?provider=${encodeURIComponent(providerType)}`
    );

    if (!response.data || response.data.length === 0) {
      return undefined;
    }

    // Filter secrets that match the credential name pattern
    const prefix = `${credentialName}:`;
    const matchingSecrets = response.data.filter(s => s.name.startsWith(prefix));

    if (matchingSecrets.length === 0) {
      return undefined;
    }

    // Fetch all secret values
    const secrets: ProviderSecrets = {};
    for (const secret of matchingSecrets) {
      const valueResponse = await this.apiClient.apiCall<SecretWithValueResponse>(
        `/secrets/${secret.id}`
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
  async setSecret(providerType: string, credentialName: string, key: string, value: string): Promise<void> {
    const secretName = `${credentialName}:${key}`;

    // Check if secret already exists
    const existing = await this.apiClient.apiCall<SecretResponse[]>(
      `/secrets/namespace/${this.namespaceId}?provider=${encodeURIComponent(providerType)}&name=${encodeURIComponent(secretName)}`
    );

    if (existing.data && existing.data.length > 0) {
      // Update existing secret
      await this.apiClient.apiCall(
        `/secrets/${existing.data[0].id}`,
        {
          method: 'PATCH',
          body: { value }
        }
      );
    } else {
      // Create new secret
      await this.apiClient.apiCall(
        '/secrets/',
        {
          method: 'POST',
          body: {
            namespace_id: this.namespaceId,
            name: secretName,
            provider: providerType,
            value
          }
        }
      );
    }
  }

  /**
   * Set all secrets for a provider credential
   */
  async setProviderSecrets(providerType: string, credentialName: string, secrets: ProviderSecrets): Promise<void> {
    // Set each secret individually
    for (const [key, value] of Object.entries(secrets)) {
      await this.setSecret(providerType, credentialName, key, value);
    }
  }

  /**
   * Check if provider has all required secrets
   */
  async hasProviderSecrets(providerType: string, credentialName: string, requiredKeys: string[]): Promise<boolean> {
    const providerSecrets = await this.getProviderSecrets(providerType, credentialName);
    if (!providerSecrets) return false;

    return requiredKeys.every(key => providerSecrets[key] && providerSecrets[key].length > 0);
  }

  /**
   * Ensure provider has all required secrets, prompting if necessary
   */
  async ensureProviderSecrets(
    providerType: string,
    credentialName: string,
    definitions: SecretDefinition[]
  ): Promise<ProviderSecrets> {
    const requiredKeys = definitions.map(d => d.key);
    const hasSecrets = await this.hasProviderSecrets(providerType, credentialName, requiredKeys);

    if (!hasSecrets) {
      // Trigger interactive setup
      return await this.promptForSecrets(providerType, credentialName, definitions);
    }

    // Load existing secrets
    return await this.getProviderSecrets(providerType, credentialName) || {};
  }

  /**
   * Interactively prompt for secrets
   */
  async promptForSecrets(providerType: string, credentialName: string, definitions: SecretDefinition[]): Promise<ProviderSecrets> {
    // Clear screen and show header
    console.clear();
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   🔐 Credential Setup: ${providerType}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log();
    console.log(`Setting up credential: "${credentialName}"`);
    console.log();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const secrets: ProviderSecrets = {};

    for (let i = 0; i < definitions.length; i++) {
      const def = definitions[i];
      const existingValue = await this.getSecret(providerType, credentialName, def.key);

      if (existingValue && !def.required) {
        secrets[def.key] = existingValue;
        continue;
      }

      // Show progress
      console.log(`\n[${i + 1}/${definitions.length}] ${def.label}`);

      if (def.required) {
        console.log('    (required)');
      } else {
        console.log('    (optional)');
      }

      const prompt = existingValue
        ? `\n    Enter value [press enter to keep existing]: `
        : `\n    Enter value: `;

      const value = await new Promise<string>((resolve) => {
        rl.question(prompt, (answer) => {
          resolve(answer.trim());
        });
      });

      if (value) {
        secrets[def.key] = value;
        console.log(`    ✓ Saved`);
      } else if (existingValue) {
        secrets[def.key] = existingValue;
        console.log(`    ✓ Kept existing value`);
      } else if (def.required) {
        console.log();
        console.error(`    ❌ ${def.label} is required`);
        rl.close();
        process.exit(1);
      } else {
        console.log(`    ⊘ Skipped`);
      }
    }

    rl.close();

    // Save the secrets to backend
    await this.setProviderSecrets(providerType, credentialName, secrets);

    console.log();
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   ✅ Credential "${credentialName}" saved successfully!`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log();

    return secrets;
  }

  /**
   * Clear all secrets for a provider credential
   */
  async clearProviderSecrets(providerType: string, credentialName: string): Promise<void> {
    // List all secrets for this provider and credential
    const response = await this.apiClient.apiCall<SecretResponse[]>(
      `/secrets/namespace/${this.namespaceId}?provider=${encodeURIComponent(providerType)}`
    );

    if (!response.data || response.data.length === 0) {
      return;
    }

    // Filter secrets that match the credential name pattern
    const prefix = `${credentialName}:`;
    const matchingSecrets = response.data.filter(s => s.name.startsWith(prefix));

    // Delete each matching secret
    for (const secret of matchingSecrets) {
      await this.apiClient.apiCall(
        `/secrets/${secret.id}`,
        { method: 'DELETE' }
      );
    }
  }

  /**
   * Clear all secrets in the namespace
   */
  async clearAllSecrets(): Promise<void> {
    // List all secrets in the namespace
    const response = await this.apiClient.apiCall<SecretResponse[]>(
      `/secrets/namespace/${this.namespaceId}`
    );

    if (!response.data || response.data.length === 0) {
      return;
    }

    // Delete each secret
    for (const secret of response.data) {
      await this.apiClient.apiCall(
        `/secrets/${secret.id}`,
        { method: 'DELETE' }
      );
    }
  }
}
