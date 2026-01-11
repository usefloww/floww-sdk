import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { BaseAIProvider, AIProviderConfig } from "./base";

export type GoogleConfig = AIProviderConfig & {
  baseURL?: string;
};

/**
 * Google AI Provider
 *
 * Provides access to Google Gemini models through the SDK's credential system.
 *
 * @example
 * ```typescript
 * import { GoogleAI } from 'floww';
 *
 * const google = new GoogleAI(); // Uses 'default' credential
 * const google2 = new GoogleAI('my-google-credential'); // Uses custom credential
 * const model = google.models.gemini15Pro;
 * const model2 = google.models['gemini-1.5-pro'];
 * ```
 */
export class GoogleAI extends BaseAIProvider {
  secretDefinitions = [
    {
      key: "apiKey",
      label: "Google AI API Key",
      type: "password" as const,
      dataType: "string" as const,
      required: true,
    },
  ];

  private googleClient?: ReturnType<typeof createGoogleGenerativeAI>;

  constructor(config?: GoogleConfig | string) {
    super("google", config);
  }

  /**
   * Get or create the Google client
   */
  private getClient() {
    if (!this.googleClient) {
      this.googleClient = createGoogleGenerativeAI({
        apiKey: this.getSecret("apiKey"),
        baseURL: this.getConfig<string>("baseURL"),
      });
    }
    return this.googleClient;
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
      gemini2Flash: "gemini-2.0-flash-exp",
      gemini15Pro: "gemini-1.5-pro",
      gemini15ProLatest: "gemini-1.5-pro-latest",
      gemini15Flash: "gemini-1.5-flash",
      gemini15FlashLatest: "gemini-1.5-flash-latest",
      gemini10Pro: "gemini-1.0-pro",
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
