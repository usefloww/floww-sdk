import { Centrifuge } from "centrifuge";
import { RealtimeEvent, Trigger, RealtimeTrigger } from "../../../common";
import { EventProducer, EventStream } from "../types";
import { getAuthToken } from "../../auth/tokenUtils";
import { getWebSocketUrl } from "@/cli/config/computedConfig";
import { getMatchingTriggers } from "@/userCode/utils";

export class WebSocketEventProducer implements EventProducer {
  private centrifuge: Centrifuge | null = null;
  private isConnected = false;
  private currentStream: EventStream | null = null;
  private currentTriggers: Trigger[] = [];
  private realtimeSubscription: ReturnType<
    Centrifuge["newSubscription"]
  > | null = null;
  private devSubscription: ReturnType<Centrifuge["newSubscription"]> | null =
    null;

  constructor(private workflowId?: string) {}

  async updateTriggers(
    triggers: Trigger[],
    stream: EventStream
  ): Promise<void> {
    this.currentTriggers = triggers;
    this.currentStream = stream;

    // Filter realtime triggers
    const realtimeTriggers = triggers.filter(
      (t) => t.type !== "cron"
    ) as RealtimeTrigger[];

    // Start connection if we have realtime triggers OR dev mode, and not already connected
    if ((realtimeTriggers.length > 0 || this.workflowId) && !this.isConnected) {
      await this.connect();
    }
  }

  private async connect(): Promise<void> {
    try {
      // Get authentication token
      const token = await getAuthToken();
      if (!token) {
        console.warn(
          "No authentication token available for WebSocket connection"
        );
        return;
      }

      // Clean up existing subscriptions if we're recreating the connection
      if (this.centrifuge) {
        if (this.realtimeSubscription) {
          this.realtimeSubscription.unsubscribe();
          this.realtimeSubscription = null;
        }
        if (this.devSubscription) {
          this.devSubscription.unsubscribe();
          this.devSubscription = null;
        }
        this.centrifuge.disconnect();
      }

      // Get WebSocket URL from profile or fallback to config
      const websocketUrl = getWebSocketUrl();

      // Create Centrifuge client with authentication headers
      this.centrifuge = new Centrifuge(websocketUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      this.centrifuge.on("connected", () => {
        this.subscribeToChannel();
      });

      this.centrifuge.on("disconnected", () => {
        this.isConnected = false;
        // Don't clear subscriptions on disconnect - they'll be reused on reconnect
      });

      this.centrifuge.on("error", (ctx) => {
        console.log("WebSocket connection error:", ctx.error);
        this.isConnected = false;
      });

      this.centrifuge.connect();
      this.isConnected = true;
    } catch (error) {
      console.error("Failed to connect to WebSocket:", error);
    }
  }

  private subscribeToChannel(): void {
    if (!this.centrifuge || !this.currentStream) return;

    // Subscribe to realtime events channel
    const realtimeChannel = "workflow:events";

    // Check if subscription already exists, reuse it if it does
    if (!this.realtimeSubscription) {
      this.realtimeSubscription =
        this.centrifuge.newSubscription(realtimeChannel);

      this.realtimeSubscription.on("publication", (ctx) => {
        const realtimeEvent: RealtimeEvent = {
          type: ctx.data.type || "default",
          workflow_id: ctx.data.workflow_id || "",
          payload: ctx.data.payload || ctx.data,
          timestamp: new Date().toISOString(),
          channel: ctx.data.channel || realtimeChannel,
          __context: {
            auth_token: ctx.data.auth_token, // Pass through workflow auth token from backend
            backend_url: ctx.data.backend_url, // Pass through backend URL from backend
          },
        };

        // Just emit the event - let the engine route it to the right triggers
        this.currentStream!.emit("data", {
          type: "realtime",
          trigger: null,
          data: realtimeEvent,
        });
      });

      this.realtimeSubscription.on("subscribed", () => {
        console.log(`📡 Subscribed to realtime channel: ${realtimeChannel}`);
      });

      this.realtimeSubscription.on("error", (ctx) => {
        console.log("Subscription error:", ctx.error);
      });
    }

    // Subscribe if not already subscribed (handles reconnection case)
    if (this.realtimeSubscription.state !== "subscribed") {
      this.realtimeSubscription.subscribe();
    }

    // Subscribe to dev webhook channel if workflowId is provided
    if (this.workflowId) {
      const devChannel = `workflow:${this.workflowId}`;

      // Check if subscription already exists, reuse it if it does
      if (!this.devSubscription) {
        this.devSubscription = this.centrifuge.newSubscription(devChannel);

        this.devSubscription.on("publication", (ctx) => {
          if (ctx.data.type === "webhook") {
            const matchingTriggers = getMatchingTriggers(this.currentTriggers, {
              type: ctx.data.trigger_metadata.provider_type,
              alias: ctx.data.trigger_metadata.provider_alias,
              triggerType: ctx.data.trigger_metadata.trigger_type,
              input: ctx.data.trigger_metadata.input,
            });

            if (matchingTriggers.length === 0) {
              console.warn(
                `Received webhook event but no matching triggers found`,
                ctx.data.trigger_metadata
              );
              return;
            } else {
              for (const trigger of matchingTriggers) {
                this.currentStream!.emit("data", {
                  type: "webhook",
                  trigger: trigger,
                  data: {
                    body: ctx.data.body,
                    headers: ctx.data.headers,
                    query: ctx.data.query,
                    method: ctx.data.method,
                    path: ctx.data.path,
                    __context: {
                      auth_token: ctx.data.auth_token, // Pass through workflow auth token from backend
                      backend_url: ctx.data.backend_url, // Pass through backend URL from backend
                    },
                  },
                });
              }
            }
          }
        });

        this.devSubscription.on("subscribed", () => {
          console.log(`📡 Subscribed to dev webhook channel: ${devChannel}`);
        });

        this.devSubscription.on("error", (ctx) => {
          console.log("Dev subscription error:", ctx.error);
        });
      }

      // Subscribe if not already subscribed (handles reconnection case)
      if (this.devSubscription.state !== "subscribed") {
        this.devSubscription.subscribe();
      }
    }
  }

  async stop(): Promise<void> {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
      this.realtimeSubscription = null;
    }
    if (this.devSubscription) {
      this.devSubscription.unsubscribe();
      this.devSubscription = null;
    }
    if (this.centrifuge) {
      this.centrifuge.disconnect();
      this.centrifuge = null;
      this.isConnected = false;
      this.currentStream = null;
    }
  }
}
