import { Builtin } from "@developerflows/floww-sdk";

export const builtin = new Builtin();

type CustomBody = {
  message: string;
};

builtin.triggers.onWebhook<CustomBody>({
  handler: (ctx, event) => {
    console.log("Webhook received:", event.body.message);
    console.log("Headers:", event.headers);
  },
  path: "/custom",
});
