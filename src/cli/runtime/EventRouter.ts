import {
  Trigger,
  WebhookTrigger,
  CronTrigger,
  RealtimeTrigger,
} from "../../common";
import { EventStream, EventProducer } from "./types";
import { WebhookEventProducer } from "./eventProducers/webhookEventProducer";
import { CronEventProducer } from "./eventProducers/cronEventProducer";
import { WebSocketEventProducer } from "./eventProducers/websocketEventProducer";
import { DebugContext } from "@/codeExecution";
import { logger } from "../utils/logger";

/**
 * Setup event routing to userspace (websocket + local events).
 *
 * EventRouter is a CLASS because it needs to:
 * - Maintain state (eventStream, producers, current triggers)
 * - Manage lifecycle (start/stop servers)
 * - Handle asynchronous event routing
 *
 * Responsibilities:
 * - Start event producers (webhook, cron, websocket servers)
 * - Route incoming events to matching trigger handlers
 * - Update triggers on code reload
 * - Manage cleanup on shutdown
 */
export class EventRouter {
  private eventStream = new EventStream();
  private eventProducers: EventProducer[];
  private currentTriggers: Trigger[] = [];
  private needsSeparator = false;

  constructor(
    port: number,
    host: string,
    private debugContext?: DebugContext,
  ) {
    // Initialize event producers
    this.eventProducers = [
      new WebhookEventProducer(port, host),
      new CronEventProducer(),
      new WebSocketEventProducer(),
    ];

    // Setup event routing immediately
    this.setupEventRouting();
  }

  /**
   * Start event routing with initial triggers
   *
   * @param triggers - Initial triggers from user code
   */
  async start(triggers: Trigger[]): Promise<void> {
    this.currentTriggers = triggers;

    // Update all producers with triggers
    for (const producer of this.eventProducers) {
      await producer.updateTriggers(triggers, this.eventStream);
    }

    // Log triggers in debug mode
    if (this.debugContext) {
      this.logTriggers(triggers);
    }

    console.log(
      `✅ Event routing started with ${triggers.length} trigger(s)`,
    );
  }

  /**
   * Update triggers (on code reload)
   *
   * @param triggers - New triggers from reloaded user code
   */
  async updateTriggers(triggers: Trigger[]): Promise<void> {
    this.currentTriggers = triggers;

    // Update all producers
    for (const producer of this.eventProducers) {
      await producer.updateTriggers(triggers, this.eventStream);
    }

    // Log triggers in debug mode
    if (this.debugContext) {
      this.logTriggers(triggers);
    }

    logger.debugInfo("Triggers reloaded successfully");
  }

  /**
   * Stop event routing and cleanup resources
   */
  async stop(): Promise<void> {
    for (const producer of this.eventProducers) {
      await producer.stop();
    }

    this.eventStream.removeAllListeners();
  }

  /**
   * Setup event routing handlers
   *
   * Routes incoming events from producers to matching trigger handlers.
   * Handles webhook, cron, and realtime event types.
   */
  private setupEventRouting(): void {
    this.eventStream.on("data", async (event) => {
      const startTime = Date.now();

      // Add separator line above execution if needed
      if (this.needsSeparator) {
        console.log();
      }

      // Create a compact, structured log entry
      let eventInfo = "";
      if (event.type === "webhook") {
        const method = event.data?.method || "POST";
        const path = event.data?.path || "/webhook";
        eventInfo = `${method} ${path}`;
      } else if (event.type === "cron") {
        eventInfo = event.data?.expression || "scheduled";
      } else if (event.type === "realtime") {
        eventInfo = `${event.data?.channel || "unknown"}`;
      } else {
        eventInfo = event.type;
      }

      try {
        if (event.trigger) {
          // Direct trigger provided (webhook/cron)
          await event.trigger.handler({}, event.data);
        } else if (event.type === "realtime") {
          // Find matching realtime triggers
          const realtimeTriggers = this.currentTriggers.filter(
            (t) => t.type === "realtime",
          ) as RealtimeTrigger[];

          for (const trigger of realtimeTriggers) {
            if (
              trigger.channel === event.data.channel &&
              (!trigger.messageType || trigger.messageType === event.data.type)
            ) {
              await trigger.handler({}, event.data);
            }
          }
        }

        const executionTime = Date.now() - startTime;

        // Single success log with all info
        logger.console.success(
          `${event.type} ${eventInfo} → completed in ${executionTime}ms`,
        );

        // Set flag to add separator before next execution
        this.needsSeparator = true;
      } catch (error) {
        const executionTime = Date.now() - startTime;

        // Single error log with all info
        logger.console.error(
          `${event.type} ${eventInfo} → failed after ${executionTime}ms`,
        );

        if (this.debugContext) {
          this.debugContext.reportError(error, {
            eventType: event.type,
            eventData: event.data,
            triggerType: event.trigger?.type || "unknown",
          });
        } else {
          logger.debugInfo(`Error details:`, error);
        }

        // Set flag to add separator before next execution
        this.needsSeparator = true;
      }
    });
  }

  /**
   * Log registered triggers in debug mode
   */
  private logTriggers(triggers: Trigger[]): void {
    logger.debugInfo("Registered triggers:");
    for (const trigger of triggers) {
      if (trigger.type === "webhook") {
        logger.console.debug(
          `  📌 Webhook: ${(trigger as WebhookTrigger).method || "POST"} /webhook${(trigger as WebhookTrigger).path || ""}`,
        );
      } else if (trigger.type === "cron") {
        logger.console.debug(
          `  ⏰ Cron: ${(trigger as CronTrigger).expression}`,
        );
      } else if (trigger.type === "realtime") {
        logger.console.debug(
          `  📡 Realtime: ${(trigger as RealtimeTrigger).channel}`,
        );
      }
    }
  }
}
