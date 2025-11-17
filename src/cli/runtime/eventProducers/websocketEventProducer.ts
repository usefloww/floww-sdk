import { Centrifuge } from "centrifuge";
import { RealtimeEvent, Trigger, RealtimeTrigger } from "../../../common";
import { EventProducer, EventStream } from "../types";
import { getAuthToken } from "../../auth/tokenUtils";
import { loadActiveProfile } from "../../auth/authUtils";
import { getConfig } from "../../config/configUtils";

export class WebSocketEventProducer implements EventProducer {
  private centrifuge: Centrifuge | null = null;
  private isConnected = false;
  private currentStream: EventStream | null = null;
  private currentTriggers: Trigger[] = [];

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

      // Get WebSocket URL from profile or fallback to config
      const profile = loadActiveProfile();
      let websocketUrl: string;

      if (profile) {
        websocketUrl = profile.config.websocket_url;
      } else {
        const config = getConfig();
        websocketUrl = config.websocketUrl;
      }

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
    const realtimeSubscription =
      this.centrifuge.newSubscription(realtimeChannel);

    realtimeSubscription.on("publication", (ctx) => {
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

    realtimeSubscription.on("subscribed", () => {
      console.log(`📡 Subscribed to realtime channel: ${realtimeChannel}`);
    });

    realtimeSubscription.on("error", (ctx) => {
      console.log("Subscription error:", ctx.error);
    });

    realtimeSubscription.subscribe();

    // Subscribe to dev webhook channel if workflowId is provided
    if (this.workflowId) {
      const devChannel = `workflow:${this.workflowId}`;
      const devSubscription = this.centrifuge.newSubscription(devChannel);

      devSubscription.on("publication", (ctx) => {
        if (ctx.data.type === "webhook") {
          // Match trigger by metadata
          const matchingTrigger = this.currentTriggers.find((t: any) => {
            if (!t._providerMeta || !ctx.data.trigger_metadata) return false;

            return (
              t._providerMeta.type ===
                ctx.data.trigger_metadata.provider_type &&
              t._providerMeta.alias ===
                ctx.data.trigger_metadata.provider_alias &&
              t._providerMeta.triggerType ===
                ctx.data.trigger_metadata.trigger_type &&
              JSON.stringify(t._providerMeta.input) ===
                JSON.stringify(ctx.data.trigger_metadata.input)
            );
          });

          if (matchingTrigger) {
            // Emit webhook event with matched trigger
            this.currentStream!.emit("data", {
              type: "webhook",
              trigger: matchingTrigger,
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
          } else {
            console.warn(
              `Received webhook event but no matching trigger found`,
              ctx.data.trigger_metadata
            );
          }
        }
      });

      devSubscription.on("subscribed", () => {
        console.log(`📡 Subscribed to dev webhook channel: ${devChannel}`);
      });

      devSubscription.on("error", (ctx) => {
        console.log("Dev subscription error:", ctx.error);
      });

      devSubscription.subscribe();
    }
  }

  async stop(): Promise<void> {
    if (this.centrifuge) {
      this.centrifuge.disconnect();
      this.centrifuge = null;
      this.isConnected = false;
      this.currentStream = null;
    }
  }
}
