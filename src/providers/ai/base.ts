import { BaseProvider, BaseProviderConfig } from "../base";

export type AIProviderConfig = BaseProviderConfig & {
  // Additional AI-specific configuration can go here
};

/**
 * Base class for AI providers that extends the standard BaseProvider
 * and adds dynamic model access via a Proxy
 */
export abstract class BaseAIProvider extends BaseProvider {
  /**
   * Abstract method that creates a language model instance.
   * Each provider implements this to return their specific model.
   */
  protected abstract createModel(modelId: string): any;

  /**
   * Proxy object that allows dynamic model access.
   * Usage: provider.models.gpt4o or provider.models['gpt-4o']
   */
  public readonly models: Record<string, any>;

  constructor(providerType: string, config?: AIProviderConfig | string) {
    super(providerType, config);

    // Create a proxy that dynamically creates models on access
    this.models = new Proxy({} as Record<string, any>, {
      get: (target, prop: string) => {
        // Convert camelCase to kebab-case for model IDs
        // e.g., gpt4o -> gpt-4o, gpt4oMini -> gpt-4o-mini
        const modelId = this.normalizeModelId(prop);

        // Cache the model instance
        if (!target[prop]) {
          target[prop] = this.createModel(modelId);
        }

        return target[prop];
      },
    });
  }

  /**
   * Normalize model ID from property access to actual model name.
   * Can be overridden by specific providers if needed.
   */
  protected normalizeModelId(propertyName: string): string {
    // Convert camelCase to kebab-case
    // gpt4o -> gpt-4o
    // gpt4oMini -> gpt-4o-mini
    // claude3Opus -> claude-3-opus
    return propertyName
      .replace(/([a-z])([0-9])/g, "$1-$2")
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .toLowerCase();
  }
}
