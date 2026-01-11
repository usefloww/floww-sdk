// Export ExecutionContext for use by services
export { ExecutionContext } from './cli/runtime/ExecutionContext';
export type { ExecutionContextData } from './cli/runtime/ExecutionContext';

export type BaseContext = {
  // Base context is now empty - providers are instantiated directly
};

export type Handler<TEvent = any, TContext = any> = (
  ctx: TContext,
  event: TEvent,
) => void | Promise<void>;

// Base event with framework metadata
export type BaseEvent = {
  /** Framework metadata - not part of the user event data */
  __context?: {
    auth_token?: string; // Short-lived JWT for workflow-to-backend authentication
    backend_url?: string; // Backend URL for API calls
    workflow_id?: string; // Workflow ID for the current execution
  };
};

// Base trigger interface
export interface Trigger<TEvent = any, TContext = any> {
  type: string;
  handler: Handler<TEvent, TContext>;
}

// Webhook-specific types
export type WebhookEvent<TBody = any> = BaseEvent & {
  body: TBody;
  headers: Record<string, string>;
  query: Record<string, string>;
  method: string;
  path: string;
};

export type WebhookContext = BaseContext & {
  // Add webhook-specific context utilities here
  // e.g., respond, setStatus, etc.
};

// Webhook-specific trigger
export interface WebhookTrigger<TBody = any>
  extends Trigger<WebhookEvent<TBody>, WebhookContext> {
  type: "webhook";
  handler: Handler<WebhookEvent<TBody>, WebhookContext>;
  path?: string;
  method?: "POST" | "GET" | "PUT" | "DELETE";
  validation?: (event: WebhookEvent<TBody>) => boolean | Promise<boolean>;
  setup?: (ctx: WebhookSetupContext) => Promise<void> | void;
  teardown?: (ctx: WebhookTeardownContext) => Promise<void> | void;
}

export type WebhookSetupContext = {
  webhookUrl: string; // Full URL where webhook will be available
  // Store metadata that can be used during teardown
  setMetadata: (key: string, value: any) => void;
};

export type WebhookTeardownContext = {
  // Retrieve metadata stored during setup
  getMetadata: (key: string) => any;
};

// Webhook trigger args
export type WebhookTriggerArgs<TBody = any> = {
  handler: Handler<WebhookEvent<TBody>, WebhookContext>;
  path?: string;
  method?: "POST" | "GET" | "PUT" | "DELETE";
  setup?: (ctx: WebhookSetupContext) => Promise<void> | void;
  teardown?: (ctx: WebhookTeardownContext) => Promise<void> | void;
};

// Cron-specific trigger
export type CronEvent = BaseEvent & {
  scheduledTime: Date;
  actualTime: Date;
};

export type CronContext = BaseContext & {
  // Add cron-specific context utilities here
};

export interface CronTrigger extends Trigger<CronEvent, CronContext> {
  type: "cron";
  handler: Handler<CronEvent, CronContext>;
  expression: string;
  setup?: (ctx: CronSetupContext) => Promise<void> | void;
  teardown?: (ctx: CronTeardownContext) => Promise<void> | void;
}

export type CronSetupContext = {
  // cron-specific setup context
};

export type CronTeardownContext = {
  // cron-specific teardown context
};

// Cron trigger args
export type CronTriggerArgs = {
  expression: string;
  handler: Handler<CronEvent, CronContext>;
  setup?: (ctx: CronSetupContext) => Promise<void> | void;
  teardown?: (ctx: CronTeardownContext) => Promise<void> | void;
};

// Realtime-specific trigger
export type RealtimeEvent<TPayload = any> = BaseEvent & {
  type: string;
  workflow_id: string;
  payload: TPayload;
  timestamp: string;
  channel: string;
};

export type RealtimeContext = BaseContext & {
  // Add realtime-specific context utilities here
  // e.g., send response, get channel info, etc.
};

export interface RealtimeTrigger<TPayload = any>
  extends Trigger<RealtimeEvent<TPayload>, RealtimeContext> {
  type: "realtime";
  handler: Handler<RealtimeEvent<TPayload>, RealtimeContext>;
  channel: string;
  messageType?: string; // Optional filter for specific message types
  authentication?: () => Promise<string>; // JWT token provider function
  setup?: (ctx: RealtimeSetupContext) => Promise<void> | void;
  teardown?: (ctx: RealtimeTeardownContext) => Promise<void> | void;
}

export type RealtimeSetupContext = {
  channel: string;
  // Store metadata that can be used during teardown
  setMetadata: (key: string, value: any) => void;
};

export type RealtimeTeardownContext = {
  // Retrieve metadata stored during setup
  getMetadata: (key: string) => any;
};

// Realtime trigger args
export type RealtimeTriggerArgs<TPayload = any> = {
  handler: Handler<RealtimeEvent<TPayload>, RealtimeContext>;
  channel: string;
  messageType?: string;
  authentication?: () => Promise<string>;
  setup?: (ctx: RealtimeSetupContext) => Promise<void> | void;
  teardown?: (ctx: RealtimeTeardownContext) => Promise<void> | void;
};

// Manual-specific trigger
export type ManualEvent<TInput = any> = BaseEvent & {
  manually_triggered: boolean;
  triggered_by: string;
  input_data: TInput;
};

export type ManualContext = BaseContext & {
  // Add manual-specific context utilities here
};

export interface ManualTrigger<TInput = any>
  extends Trigger<ManualEvent<TInput>, ManualContext> {
  type: "manual";
  handler: Handler<ManualEvent<TInput>, ManualContext>;
  name: string;
  description?: string;
  inputSchema?: Record<string, any>; // JSON Schema for input validation
}

// Manual trigger args
export type ManualTriggerArgs<TInput = any> = {
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
  handler: Handler<ManualEvent<TInput>, ManualContext>;
};

export interface Action {}

export type SecretDefinition = {
  key: string;
  label: string;
  type: "string" | "password";
  dataType: "string" | "number" | "boolean";
  required: boolean;
};

export interface Provider {
  providerType: string; // e.g., 'gitlab', 'googleCalendar'
  credentialName?: string; // User-specified credential name
  secretDefinitions?: SecretDefinition[];
  configure?: (secrets: Record<string, string>) => void;
  triggers: Record<string, (...args: any[]) => Trigger>;
  actions: Record<string, (...args: any[]) => Action>;
}
