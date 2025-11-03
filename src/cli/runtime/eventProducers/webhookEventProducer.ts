import Fastify, { FastifyInstance } from "fastify";
import { WebhookTrigger, WebhookEvent, Trigger } from "../../../common";
import { EventProducer, EventStream } from "../types";
import { randomUUID } from "crypto";

type WebhookMetadata = {
  trigger: WebhookTrigger;
  path: string;
  url: string;
  metadata: Map<string, any>;
};

export class WebhookEventProducer implements EventProducer {
  private app: FastifyInstance | null = null;
  private webhooks: Map<string, WebhookMetadata> = new Map();
  private isServerStarted = false;

  constructor(
    private port: number,
    private host: string,
  ) {}

  async updateTriggers(
    triggers: Trigger[],
    stream: EventStream,
  ): Promise<void> {
    // Filter webhook triggers
    const webhookTriggers = triggers.filter(
      (t) => t.type === "webhook",
    ) as WebhookTrigger[];

    // Call teardown on old triggers that are being removed
    for (const [path, webhookMeta] of this.webhooks.entries()) {
      if (!webhookTriggers.includes(webhookMeta.trigger)) {
        if (webhookMeta.trigger.teardown) {
          try {
            await webhookMeta.trigger.teardown({
              getMetadata: (key: string) => webhookMeta.metadata.get(key),
            });
          } catch (error) {
            console.error(`❌ Failed to teardown webhook ${path}:`, error);
          }
        }
      }
    }

    // Update webhooks map
    this.webhooks.clear();
    for (const trigger of webhookTriggers) {
      // Generate unique path for this webhook
      const path = trigger.path || `/${randomUUID()}`;
      const webhookUrl = `http://${this.host}:${this.port}/webhook${path}`;

      // Create metadata storage
      const metadata = new Map<string, any>();

      // Store webhook info
      this.webhooks.set(path, {
        trigger,
        path,
        url: webhookUrl,
        metadata,
      });

      // Call setup hook if exists
      if (trigger.setup) {
        try {
          await trigger.setup({
            webhookUrl,
            setMetadata: (key: string, value: any) => metadata.set(key, value),
          });
        } catch (error) {
          console.error(`❌ Failed to setup webhook ${path}:`, error);
          throw error;
        }
      }
    }

    // Start server if not already started
    if (!this.isServerStarted && webhookTriggers.length > 0) {
      this.app = Fastify({ logger: { level: "warn" } });
      this.app.addContentTypeParser(
        "application/json",
        { parseAs: "string" },
        (req, body, done) => {
          try {
            done(null, JSON.parse(body as string));
          } catch (err: any) {
            done(err, undefined);
          }
        },
      );

      this.app.all("/webhook/*", async (request, reply) => {
        const path = request.url.replace("/webhook", "");
        const webhookMeta = this.webhooks.get(path);

        if (!webhookMeta) {
          return reply.code(404).send({ error: "Webhook not found" });
        }

        const webhookEvent: WebhookEvent = {
          body: request.body || {},
          headers: request.headers as Record<string, string>,
          query: request.query as Record<string, string>,
          method: request.method,
          path: request.url,
        };

        if (webhookMeta.trigger.validation) {
          try {
            const isValid = await webhookMeta.trigger.validation(webhookEvent);
            if (!isValid) {
              return reply
                .code(401)
                .send({ error: "Webhook validation failed" });
            }
          } catch (error) {
            console.error("Webhook validation error:", error);
            return reply.code(401).send({ error: "Webhook validation failed" });
          }
        }

        stream.emit("data", { type: "webhook", trigger: webhookMeta.trigger, data: webhookEvent });
        return reply.code(200).send({ success: true });
      });

      await this.app.listen({ port: this.port, host: this.host });
      console.log(
        `🌐 Webhook server listening on http://${this.host}:${this.port}`,
      );
      this.isServerStarted = true;
    }
  }

  async stop(): Promise<void> {
    // Call teardown on all webhooks
    for (const [path, webhookMeta] of this.webhooks.entries()) {
      if (webhookMeta.trigger.teardown) {
        try {
          await webhookMeta.trigger.teardown({
            getMetadata: (key: string) => webhookMeta.metadata.get(key),
          });
        } catch (error) {
          console.error(`❌ Failed to teardown webhook ${path}:`, error);
        }
      }
    }

    // Clear webhooks
    this.webhooks.clear();

    // Stop server
    if (this.app) {
      await this.app.close();
      this.app = null;
      this.isServerStarted = false;
    }
  }

  getAvailableWebhooks(): Array<{
    method: string;
    url: string;
    path: string;
    trigger: WebhookTrigger;
  }> {
    return Array.from(this.webhooks.values()).map((webhookMeta) => ({
      method: webhookMeta.trigger.method || "POST",
      url: webhookMeta.url,
      path: webhookMeta.path,
      trigger: webhookMeta.trigger,
    }));
  }
}
