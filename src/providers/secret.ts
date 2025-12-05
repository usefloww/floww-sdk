import { z, ZodObject, ZodRawShape, ZodTypeAny } from "zod";
import { BaseProvider } from "./base";
import { SecretDefinition } from "../common";

export class Secret<T extends ZodRawShape> extends BaseProvider {
  private schema!: ZodObject<T>;
  private cachedValue?: z.infer<ZodObject<T>>;

  triggers = {};
  actions = {};

  // Static map to pass schema to initialize() before super() completes
  private static pendingSchema: ZodObject<any> | undefined;

  constructor(
    name: string,
    schema: ZodObject<T>,
    credential: string = "default"
  ) {
    // Store schema in static field so initialize() can access it
    Secret.pendingSchema = schema;
    super(name, credential);
    this.schema = schema;
    Secret.pendingSchema = undefined;
  }

  protected override initialize(): void {
    // Get schema from static field (set before super() call)
    if (Secret.pendingSchema) {
      this.schema = Secret.pendingSchema as ZodObject<T>;
      this.secretDefinitions = this.zodToSecretDefinitions();
    }
    super.initialize();
  }

  value(): z.infer<ZodObject<T>> {
    if (this.cachedValue !== undefined) {
      return this.cachedValue;
    }

    // Secrets are now stored as a JSON object and merged into config/secrets
    // Try to get from config first (merged from backend)
    const secretsObject = this.config;

    // Check if we have any of the expected keys
    const schemaKeys = Object.keys(this.schema.shape);
    const hasAnyKey = schemaKeys.some(key => secretsObject[key] !== undefined);

    if (!hasAnyKey) {
      console.error(`[Secret Debug] Provider: ${this.providerType}:${this.credentialName}`);
      console.error(`[Secret Debug] Expected keys:`, schemaKeys);
      console.error(`[Secret Debug] Available config keys:`, Object.keys(secretsObject));
      console.error(`[Secret Debug] Config values:`, secretsObject);
      throw new Error(
        `${this.providerType} credential '${this.credentialName}' not configured.`
      );
    }

    // Build object from config
    const result: Record<string, any> = {};
    for (const key of schemaKeys) {
      if (secretsObject[key] !== undefined) {
        result[key] = secretsObject[key];
      }
    }

    this.cachedValue = this.schema.parse(result);
    return this.cachedValue;
  }

  private zodToSecretDefinitions(): SecretDefinition[] {
    return Object.entries(this.schema.shape).map(([key, zodType]) => ({
      key,
      label: key,
      type: this.isPasswordField(key) ? "password" : "string",
      dataType: this.getDataType(zodType as ZodTypeAny),
      required: !this.isOptional(zodType as ZodTypeAny),
    }));
  }

  private getDataType(zodType: ZodTypeAny): "string" | "number" | "boolean" {
    // Check the type property (works with current Zod versions)
    const type = (zodType as any).type || (zodType as any).def?.type;

    if (type === 'number') return 'number';
    if (type === 'boolean') return 'boolean';

    // Also check legacy _def.typeName for older Zod versions
    const typeName = zodType._def?.typeName;
    if (typeName === 'ZodNumber') return 'number';
    if (typeName === 'ZodBoolean') return 'boolean';

    // Handle wrapped types (optional, nullable, default)
    if (typeName === 'ZodOptional' || typeName === 'ZodNullable' || typeName === 'ZodDefault') {
      return this.getDataType(zodType._def.innerType);
    }

    return 'string';
  }

  private isOptional(zodType: ZodTypeAny): boolean {
    return zodType.isOptional?.() ?? false;
  }

  private isPasswordField(key: string): boolean {
    const lower = key.toLowerCase();
    return (
      lower.includes("password") ||
      lower.includes("secret") ||
      lower.includes("token") ||
      lower.includes("key")
    );
  }
}
