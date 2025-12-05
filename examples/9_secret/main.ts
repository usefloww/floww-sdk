import { Builtin, Secret } from "floww";
import { z } from "zod";

export const builtin = new Builtin();

const dbConfig = new Secret("database", z.object({
  host: z.string(),
  port: z.number(),
  password: z.string(),
}));

builtin.triggers.onWebhook({
  path: "/test-secret",
  handler: () => {
    console.log("Database config:", dbConfig.value());
  },
});

