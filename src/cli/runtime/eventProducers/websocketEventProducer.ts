import { Centrifuge } from "centrifuge";
import { RealtimeEvent, Trigger, RealtimeTrigger } from "../../../common";
import { EventProducer, EventStream } from "../types";
import { getAuthToken } from "../../auth/tokenUtils";
import { getConfig } from "../../config/configUtils";

export class WebSocketEventProducer implements EventProducer {
  private centrifuge: Centrifuge | null = null;
  private isConnected = false;
  private currentStream: EventStream | null = null;

  async updateTriggers(
    triggers: Trigger[],
    stream: EventStream,
  ): Promise<void> {
    // Filter realtime triggers
    const realtimeTriggers = triggers.filter(
      (t) => t.type === "realtime",
    ) as RealtimeTrigger[];
    this.currentStream = stream;

    // Start connection if we have realtime triggers and not already connected
    if (realtimeTriggers.length > 0 && !this.isConnected) {
      await this.connect();
    }
  }

  private async connect(): Promise<void> {
    try {
      // Get authentication token
      const token = await getAuthToken();
      if (!token) {
        console.warn(
          "No authentication token available for WebSocket connection",
        );
        return;
      }

      // Get WebSocket URL from config
      const config = getConfig();

      // Create Centrifuge client with authentication headers
      this.centrifuge = new Centrifuge(config.websocketUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      this.centrifuge.on("connected", () => {
        console.log("Connected to WebSocket");
        this.subscribeToChannel();
      });

      this.centrifuge.on("disconnected", () => {
        console.log("Disconnected from WebSocket");
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

    // Subscribe to workflow events channel
    const channel = "workflow:events";
    const subscription = this.centrifuge.newSubscription(channel);

    subscription.on("publication", (ctx) => {
      const realtimeEvent: RealtimeEvent = {
        type: ctx.data.type || "default",
        workflow_id: ctx.data.workflow_id || "",
        payload: ctx.data.payload || ctx.data,
        timestamp: new Date().toISOString(),
        channel: ctx.data.channel || channel,
      };

      // Just emit the event - let the engine route it to the right triggers
      this.currentStream!.emit("data", {
        type: "realtime",
        trigger: null,
        data: realtimeEvent,
      });
    });

    subscription.on("subscribed", () => {
      console.log(`📡 Subscribed to realtime channel: ${channel}`);
    });

    subscription.on("error", (ctx) => {
      console.log("Subscription error:", ctx.error);
    });

    subscription.subscribe();
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
