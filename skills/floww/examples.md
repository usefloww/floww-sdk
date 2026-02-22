# Floww Examples

Complete, working automation examples. Use these as templates when building automations.

---

## 1. Cron: Daily Slack Summary

Sends a summary message to Slack every day at 9 AM UTC.

```typescript
import { Builtin, Slack } from "floww";

const builtin = new Builtin();
const slack = new Slack();

builtin.triggers.onCron({
  expression: "0 9 * * *", // 9:00 AM UTC daily
  handler: async (ctx, event) => {
    await slack.actions.sendMessage({
      channel: "#daily-updates",
      text: `Good morning! Daily summary for ${new Date(event.scheduledTime).toDateString()}`,
    });
  },
});
```

---

## 2. Webhook: Process Incoming Data

Receives webhook POST requests, validates the payload, and stores it.

```typescript
import { Builtin, KVStore } from "floww";

const builtin = new Builtin();
const kv = new KVStore();

type OrderPayload = {
  orderId: string;
  customer: string;
  amount: number;
};

builtin.triggers.onWebhook<OrderPayload>({
  path: "/orders",
  method: "POST",
  handler: async (ctx, event) => {
    const { orderId, customer, amount } = event.body;

    if (!orderId || !customer) {
      console.error("Missing required fields");
      return;
    }

    await kv.set("orders", orderId, {
      customer,
      amount,
      receivedAt: new Date().toISOString(),
    });

    console.log(`Order ${orderId} stored for ${customer}: $${amount}`);
  },
});
```

---

## 3. GitHub Push -> Slack Notification

Notifies a Slack channel when someone pushes to the main branch.

```typescript
import { GitHub, Slack } from "floww";

const github = new GitHub();
const slack = new Slack();

github.triggers.onPush({
  owner: "my-org",
  repository: "my-repo",
  branch: "main",
  handler: async (ctx, event) => {
    const push = event.body;
    const commitCount = push.commits.length;
    const pusher = push.pusher.name;
    const commitList = push.commits
      .map((c: any) => `- ${c.message}`)
      .join("\n");

    await slack.actions.sendMessage({
      channel: "#deployments",
      text: `*${pusher}* pushed ${commitCount} commit(s) to \`main\`:\n${commitList}`,
      mrkdwn: true,
    });
  },
});
```

---

## 4. AI-Powered Slack Bot

A Slack bot that answers questions using AI, with tool calling for channel history search.

```typescript
import { Slack, AI } from "floww";
import { generateText, stepCountIs } from "floww/ai";
import { z } from "zod";

const slack = new Slack();
const ai = new AI();

slack.triggers.onMessage({
  channelId: "C09PT6F7NMR", // Your channel ID
  handler: async (ctx, event) => {
    const msg = event.body.event;

    const result = await generateText({
      model: ai.models.gpt4o,
      system: "You are a helpful engineering assistant. Answer concisely.",
      prompt: msg.text,
      tools: {
        searchHistory: {
          description: "Search the channel history for related messages",
          inputSchema: z.object({
            pattern: z.string().describe("Search pattern"),
          }),
          execute: async ({ pattern }) => {
            const history = await slack.actions.conversationHistory({
              channelId: msg.channel,
              limit: 100,
            });
            const regex = new RegExp(pattern, "i");
            return (history.messages || [])
              .filter((m: any) => m.text && regex.test(m.text))
              .slice(0, 5);
          },
        },
      },
      stopWhen: stepCountIs(10),
    });

    await slack.actions.sendMessage({
      channel: msg.channel,
      text: result.text,
      thread_ts: msg.ts,
    });
  },
});
```

---

## 5. GitLab MR Auto-Review with AI

Automatically reviews GitLab merge requests using AI.

```typescript
import { Gitlab, AI } from "floww";
import { generateText } from "floww/ai";

const gitlab = new Gitlab();
const ai = new AI();

gitlab.triggers.onMergeRequest({
  projectId: "12345",
  handler: async (ctx, event) => {
    const mr = event.body;

    if (mr.object_attributes.action !== "open") return;

    const title = mr.object_attributes.title;
    const description = mr.object_attributes.description || "No description";

    const result = await generateText({
      model: ai.models.claude35SonnetLatest,
      system: "You are a senior code reviewer. Provide concise, actionable feedback.",
      prompt: `Review this merge request:\n\nTitle: ${title}\nDescription: ${description}`,
    });

    console.log("Review:", result.text);
  },
});
```

---

## 6. Multi-Provider: GitHub Issues -> Jira + Slack

When a GitHub issue is labeled "bug", creates a Jira ticket and notifies Slack.

```typescript
import { GitHub, Jira, Slack } from "floww";

const github = new GitHub();
const jira = new Jira();
const slack = new Slack();

github.triggers.onIssue({
  owner: "my-org",
  repository: "my-repo",
  actions: ["labeled"],
  handler: async (ctx, event) => {
    const issue = event.body;
    const label = issue.label?.name;

    if (label !== "bug") return;

    // Create Jira ticket
    const jiraIssue = await jira.actions.createIssue({
      projectKey: "ENG",
      issueType: "Bug",
      summary: `[GitHub] ${issue.issue.title}`,
      description: issue.issue.body || "",
      labels: ["github-sync"],
    });

    // Notify Slack
    await slack.actions.sendMessage({
      channel: "#bugs",
      text: `New bug from GitHub: *${issue.issue.title}*\nJira: ${jiraIssue.key}\nGitHub: ${issue.issue.html_url}`,
      mrkdwn: true,
    });

    console.log(`Created Jira ${jiraIssue.key} for GitHub issue #${issue.issue.number}`);
  },
});
```

---

## 7. KV Store: Rate-Limited Webhook

A webhook that uses the KV store to implement rate limiting per API key.

```typescript
import { Builtin, KVStore } from "floww";

const builtin = new Builtin();
const kv = new KVStore();

type RateLimit = {
  count: number;
  windowStart: number;
};

builtin.triggers.onWebhook<{ apiKey: string; data: any }>({
  path: "/api/ingest",
  handler: async (ctx, event) => {
    const { apiKey, data } = event.body;
    const windowMs = 60_000; // 1 minute window
    const maxRequests = 100;

    // Check rate limit
    const limit = await kv.get<RateLimit>("rate-limits", apiKey);
    const now = Date.now();

    if (limit && now - limit.windowStart < windowMs) {
      if (limit.count >= maxRequests) {
        console.log(`Rate limited: ${apiKey}`);
        return;
      }
      await kv.set("rate-limits", apiKey, {
        count: limit.count + 1,
        windowStart: limit.windowStart,
      });
    } else {
      await kv.set("rate-limits", apiKey, { count: 1, windowStart: now });
    }

    // Process the data
    console.log(`Accepted request from ${apiKey}:`, data);
  },
});
```

---

## 8. Manual Trigger with Input Schema

A manually-triggered workflow that accepts structured input from the dashboard.

```typescript
import { Builtin, Slack } from "floww";

const builtin = new Builtin();
const slack = new Slack();

builtin.triggers.onManual({
  name: "send-announcement",
  description: "Send an announcement to a Slack channel",
  inputSchema: {
    type: "object",
    properties: {
      channel: { type: "string", description: "Slack channel name" },
      message: { type: "string", description: "Announcement text" },
      urgent: { type: "boolean", description: "Prefix with warning emoji" },
    },
    required: ["channel", "message"],
  },
  handler: async (ctx, event) => {
    const { channel, message, urgent } = event.input_data;
    const prefix = urgent ? "WARNING: " : "";

    await slack.actions.sendMessage({
      channel,
      text: `${prefix}${message}`,
    });

    console.log(`Announcement sent to ${channel}`);
  },
});
```
