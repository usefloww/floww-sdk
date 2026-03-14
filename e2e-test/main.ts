import { Builtin } from "floww";
import { KVStore } from "floww/providers";

const builtin = new Builtin();
const kv = new KVStore();

function getStats() {
  return kv.getTable<number | string | unknown>("e2e-stats");
}

// --- Cron trigger: fires every minute, tracks state in KV ---
builtin.triggers.onCron({
  expression: "* * * * *",
  handler: async (_ctx, event) => {
    const stats = getStats();
    const prev = (await stats.get("totalCronFires")) ?? 0;
    const count = (prev as number) + 1;

    await stats.set("totalCronFires", count);
    await stats.set("lastCronTime", event.scheduledTime.toISOString());

    console.log(`[cron #${count}] fired at ${new Date().toISOString()}`);
    console.log(`  KV updated: totalCronFires=${count}`);
  },
});

// --- Webhook trigger: accepts POST, stores payload in KV ---
builtin.triggers.onWebhook({
  method: "POST",
  path: "/ingest",
  handler: async (_ctx, event) => {
    const stats = getStats();
    const prev = (await stats.get("totalWebhookHits")) ?? 0;
    const count = (prev as number) + 1;

    await stats.set("totalWebhookHits", count);
    await stats.set("lastWebhookPayload", event.body);

    console.log(`[webhook #${count}] received:`, JSON.stringify(event.body));
    console.log(`  method=${event.method} path=${event.path}`);
    console.log(`  KV updated: totalWebhookHits=${count}`);
  },
});

// --- Webhook trigger: GET /status reads KV and returns stats ---
builtin.triggers.onWebhook({
  method: "GET",
  path: "/status",
  handler: async (_ctx, _event) => {
    const stats = getStats();
    const cronFires = (await stats.get("totalCronFires")) ?? 0;
    const webhookHits = (await stats.get("totalWebhookHits")) ?? 0;
    const lastCron = (await stats.get("lastCronTime")) ?? null;
    const lastPayload = (await stats.get("lastWebhookPayload")) ?? null;

    const status = {
      totalCronFires: cronFires,
      totalWebhookHits: webhookHits,
      lastCronTime: lastCron,
      lastWebhookPayload: lastPayload,
    };

    console.log(`[status] queried:`, JSON.stringify(status));
  },
});

// --- Manual trigger: reset all stats ---
builtin.triggers.onManual({
  handler: async (_ctx, _event) => {
    const stats = getStats();
    await stats.delete("totalCronFires");
    await stats.delete("totalWebhookHits");
    await stats.delete("lastCronTime");
    await stats.delete("lastWebhookPayload");
    console.log("[manual] all stats reset");
  },
});
