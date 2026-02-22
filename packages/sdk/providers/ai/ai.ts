import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { BaseAIProvider, AIProviderConfig } from "./base";

export type AIConfig = AIProviderConfig & {
  provider?: string;
  baseURL?: string;
  organization?: string;
  project?: string;
};

/**
 * Unified AI Provider
 *
 * Provides access to OpenAI, Anthropic, and Google AI models through a single provider.
 * The specific AI service is determined by the `provider` config field set during
 * credential setup in the dashboard.
 *
 * @example
 * ```typescript
 * import { AI } from 'floww';
 *
 * const ai = new AI(); // Uses 'default' credential
 * const ai2 = new AI('my-ai-credential'); // Uses custom credential
 * const model = ai.models.gpt4o;
 * const model2 = ai.models.claude35Sonnet;
 * const model3 = ai.models.gemini15Pro;
 * ```
 */
export class AI extends BaseAIProvider {
  secretDefinitions = [
    {
      key: "apiKey",
      label: "API Key",
      type: "password" as const,
      dataType: "string" as const,
      required: true,
    },
  ];

  private aiClient?: ReturnType<typeof createOpenAI> | ReturnType<typeof createAnthropic> | ReturnType<typeof createGoogleGenerativeAI>;

  constructor(config?: AIConfig | string) {
    super("ai", config);
  }

  /**
   * Get the configured AI provider name (openai, anthropic, google)
   */
  private getProviderName(): string {
    return this.getConfig<string>("provider") || "openai";
  }

  /**
   * Get or create the AI client based on the configured provider
   */
  private getClient() {
    if (!this.aiClient) {
      const provider = this.getProviderName();
      const apiKey = this.getSecret("apiKey");
      const baseURL = this.getConfig<string>("baseURL");

      switch (provider) {
        case "openai":
          this.aiClient = createOpenAI({
            apiKey,
            baseURL,
            organization: this.getConfig<string>("organization"),
            project: this.getConfig<string>("project"),
          });
          break;
        case "anthropic":
          this.aiClient = createAnthropic({
            apiKey,
            baseURL,
          });
          break;
        case "google":
          this.aiClient = createGoogleGenerativeAI({
            apiKey,
            baseURL,
          });
          break;
        default:
          throw new Error(`Unknown AI provider: ${provider}. Supported: openai, anthropic, google`);
      }
    }
    return this.aiClient;
  }

  /**
   * Create a model instance for the given model ID
   * Returns a lazy proxy that only creates the actual model when accessed
   */
  protected createModel(modelId: string): any {
    return new Proxy(
      {},
      {
        get: (target: any, prop: string) => {
          if (!target.__model) {
            target.__model = this.getClient()(modelId);
          }
          return target.__model[prop];
        },
      }
    );
  }

  /**
   * Normalize model ID to handle common aliases across all providers
   */
  protected normalizeModelId(propertyName: string): string {
    const aliases: Record<string, string> = {
      // OpenAI
      gpt4o: "gpt-4o",
      gpt4oMini: "gpt-4o-mini",
      gpt4Turbo: "gpt-4-turbo",
      gpt4: "gpt-4",
      gpt35Turbo: "gpt-3.5-turbo",
      o1: "o1",
      o1Mini: "o1-mini",
      o1Preview: "o1-preview",
      // Anthropic
      claude35Sonnet: "claude-3-5-sonnet-20241022",
      claude35SonnetLatest: "claude-3-5-sonnet-latest",
      claude35Haiku: "claude-3-5-haiku-20241022",
      claude35HaikuLatest: "claude-3-5-haiku-latest",
      claude3Opus: "claude-3-opus-20240229",
      claude3OpusLatest: "claude-3-opus-latest",
      claude3Sonnet: "claude-3-sonnet-20240229",
      claude3Haiku: "claude-3-haiku-20240307",
      // Google
      gemini2Flash: "gemini-2.0-flash-exp",
      gemini15Pro: "gemini-1.5-pro",
      gemini15ProLatest: "gemini-1.5-pro-latest",
      gemini15Flash: "gemini-1.5-flash",
      gemini15FlashLatest: "gemini-1.5-flash-latest",
      gemini10Pro: "gemini-1.0-pro",
    };

    return aliases[propertyName] || super.normalizeModelId(propertyName);
  }

  actions = {};
  triggers = {};
}
