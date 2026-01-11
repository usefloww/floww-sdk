import { createAnthropic } from "@ai-sdk/anthropic";
import { BaseAIProvider, AIProviderConfig } from "./base";

export type AnthropicConfig = AIProviderConfig & {
  baseURL?: string;
};

/**
 * Anthropic AI Provider
 *
 * Provides access to Anthropic Claude models through the SDK's credential system.
 *
 * @example
 * ```typescript
 * import { Anthropic } from 'floww';
 *
 * const anthropic = new Anthropic(); // Uses 'default' credential
 * const anthropic2 = new Anthropic('my-anthropic-credential'); // Uses custom credential
 * const model = anthropic.models.claude35Sonnet;
 * const model2 = anthropic.models['claude-3-5-sonnet-20241022'];
 * ```
 */
export class Anthropic extends BaseAIProvider {
  secretDefinitions = [
    {
      key: "apiKey",
      label: "Anthropic API Key",
      type: "password" as const,
      dataType: "string" as const,
      required: true,
    },
  ];

  private anthropicClient?: ReturnType<typeof createAnthropic>;

  constructor(config?: AnthropicConfig | string) {
    super("anthropic", config);
  }

  /**
   * Get or create the Anthropic client
   */
  private getClient() {
    if (!this.anthropicClient) {
      this.anthropicClient = createAnthropic({
        apiKey: this.getSecret("apiKey"),
        baseURL: this.getConfig<string>("baseURL"),
      });
    }
    return this.anthropicClient;
  }

  /**
   * Create a model instance for the given model ID
   * Returns a lazy proxy that only creates the actual model when accessed
   */
  protected createModel(modelId: string): any {
    // Return a proxy that delays client creation until the model is actually used
    return new Proxy(
      {},
      {
        get: (target: any, prop: string) => {
          // Lazily create the actual model on first property access
          if (!target.__model) {
            target.__model = this.getClient()(modelId);
          }
          return target.__model[prop];
        },
      }
    );
  }

  /**
   * Normalize model ID to handle common aliases
   */
  protected normalizeModelId(propertyName: string): string {
    // Handle common aliases
    const aliases: Record<string, string> = {
      claude35Sonnet: "claude-3-5-sonnet-20241022",
      claude35SonnetLatest: "claude-3-5-sonnet-latest",
      claude35Haiku: "claude-3-5-haiku-20241022",
      claude35HaikuLatest: "claude-3-5-haiku-latest",
      claude3Opus: "claude-3-opus-20240229",
      claude3OpusLatest: "claude-3-opus-latest",
      claude3Sonnet: "claude-3-sonnet-20240229",
      claude3Haiku: "claude-3-haiku-20240307",
    };

    return aliases[propertyName] || super.normalizeModelId(propertyName);
  }

  // Actions can be added here following the provider pattern
  actions = {
    // Example: generateText, streamText, etc.
  };

  // Triggers can be added here if needed
  triggers = {};
}
