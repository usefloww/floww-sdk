import Fastify, { FastifyInstance } from "fastify";
import { WebhookTrigger, WebhookEvent, Trigger } from "../../../common";
import { EventProducer, EventStream } from "../types";

export class WebhookEventProducer implements EventProducer {
  private app: FastifyInstance | null = null;
  private webhooks: Map<string, WebhookTrigger> = new Map();
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

    // Update webhooks map
    this.webhooks.clear();
    for (const trigger of webhookTriggers) {
      this.webhooks.set(trigger.path || "/webhook", trigger);
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
        const trigger = this.webhooks.get(path);

        if (!trigger) {
          return reply.code(404).send({ error: "Webhook not found" });
        }

        const webhookEvent: WebhookEvent = {
          body: request.body || {},
          headers: request.headers as Record<string, string>,
          query: request.query as Record<string, string>,
          method: request.method,
          path: request.url,
        };

        if (trigger.validation) {
          try {
            const isValid = await trigger.validation(webhookEvent);
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

        stream.emit("data", { type: "webhook", trigger, data: webhookEvent });
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
    if (this.app) {
      await this.app.close();
      this.app = null;
      this.isServerStarted = false;
    }
  }
}
