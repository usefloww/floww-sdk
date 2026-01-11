import { createOpenAI } from "@ai-sdk/openai";
import { BaseAIProvider, AIProviderConfig } from "./base";

export type OpenAIConfig = AIProviderConfig & {
  baseURL?: string;
  organization?: string;
  project?: string;
};

/**
 * OpenAI AI Provider
 *
 * Provides access to OpenAI models through the SDK's credential system.
 *
 * @example
 * ```typescript
 * import { OpenAI } from 'floww';
 *
 * const openai = new OpenAI(); // Uses 'default' credential
 * const openai2 = new OpenAI('my-openai-credential'); // Uses custom credential
 * const model = openai.models.gpt4o;
 * const model2 = openai.models['gpt-4o'];
 * ```
 */
export class OpenAI extends BaseAIProvider {
  secretDefinitions = [
    {
      key: "apiKey",
      label: "OpenAI API Key",
      type: "password" as const,
      dataType: "string" as const,
      required: true,
    },
  ];

  private openaiClient?: ReturnType<typeof createOpenAI>;

  constructor(config?: OpenAIConfig | string) {
    super("openai", config);
  }

  /**
   * Get or create the OpenAI client
   */
  private getClient() {
    if (!this.openaiClient) {
      this.openaiClient = createOpenAI({
        apiKey: this.getSecret("apiKey"),
        baseURL: this.getConfig<string>("baseURL"),
        organization: this.getConfig<string>("organization"),
        project: this.getConfig<string>("project"),
      });
    }
    return this.openaiClient;
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
      gpt4o: "gpt-4o",
      gpt4oMini: "gpt-4o-mini",
      gpt4Turbo: "gpt-4-turbo",
      gpt4: "gpt-4",
      gpt35Turbo: "gpt-3.5-turbo",
      o1: "o1",
      o1Mini: "o1-mini",
      o1Preview: "o1-preview",
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
