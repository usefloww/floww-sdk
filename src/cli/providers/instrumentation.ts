export interface DetectedProvider {
  type: string;
  alias?: string;
}

export class ProviderInstrumentation {
  private detectedProviders = new Map<string, DetectedProvider>();

  instrumentCode(code: string): string {
    // Replace getProvider calls with our tracking wrapper
    return code.replace(
      /\bgetProvider\s*\(/g,
      '__trackProvider('
    );
  }

  createTrackingFunction(originalGetProvider: Function) {
    return (type: string, alias?: string) => {
      // Store the detected provider
      const key = alias || type;
      this.detectedProviders.set(key, { type, alias });

      // Call the original getProvider function
      return originalGetProvider(type, alias);
    };
  }

  getDetectedProviders(): DetectedProvider[] {
    return Array.from(this.detectedProviders.values());
  }

  clearDetectedProviders(): void {
    this.detectedProviders.clear();
  }

  hasProvider(type: string, alias?: string): boolean {
    const key = alias || type;
    return this.detectedProviders.has(key);
  }
}