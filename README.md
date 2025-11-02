# Floww SDK

**The code-first framework for building production-ready workflow automations.**

Replace complex orchestration tools with simple TypeScript code. Build workflows that respond to webhooks, run on schedules, integrate with AI, and connect to external services - all with full type safety.

```typescript
import { Github, Slack } from "floww";

const github = new Github();
const slack = new Slack();

github.triggers.onPush({
  handler: async (ctx, event) => {
    await slack.postMessage({
      channel: '#deployments',
      text: `🚀 New push to ${event.repository.name}`
    });
  }
});
```

**Start building in 30 seconds →**

## Prerequisites

- Node.js 18+ 
- TypeScript 5.0 or higher
- npm, pnpm, or yarn


## Quick Start

1. Create new projecan 

```bash
npx floww init
```

2. Install dependencies

```bash
npm install
```

3. Start developing

```bash
floww dev
```

4. Deploy to production

```bash
floww deploy
```

## Features

- **Webhook Triggers** - Handle HTTP requests with custom paths and validation
- **Cron Scheduling** - Run tasks on schedules using cron expressions
- **AI Integration** - Built-in support for OpenAI, Anthropic, Google AI with tool calling
- **TypeScript Native** - Full TypeScript support with type checking
- **Auto-reload** - Hot reload in development mode
- **Provider System** - Built-in integrations for GitLab, Google Calendar, Slack, and more

## Real-World Examples

### Daily Reports
```typescript
import { Builtin } from "floww";

const builtin = new Builtin();

builtin.triggers.onCron({
  expression: "0 9 * * 1-5",  // Weekdays at 9 AM
  handler: async (ctx) => {
    const analytics = await fetchAnalytics();
    await sendEmailReport(analytics);
  }
});
```

### AI-Powered Customer Support
```typescript
import { OpenAI, Builtin } from "floww";
import { generateText } from "floww/ai";

const openai = new OpenAI();
const builtin = new Builtin();

builtin.triggers.onWebhook({
  path: '/support',
  handler: async (ctx, event) => {
    const response = await generateText({
      model: openai.models.gpt4,
      prompt: `Customer question: ${event.body.question}`
    });

    return { answer: response.text };
  }
});
```

[Browse all examples →](./examples)

## Basic Usage

### Webhook Trigger

```typescript
import { Builtin } from "floww";

const builtin = new Builtin();

builtin.triggers.onWebhook({
  path: '/custom',
  handler: (ctx, event) => {
    console.log('Received:', event.body);
    return { success: true };
  },
});
```

Test it:
```bash
curl -X POST http://localhost:3000/webhooks/custom \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
```

### Cron Trigger

```typescript
builtin.triggers.onCron({
  expression: "0 9 * * 1-5",  // Weekdays at 9 AM
  handler: (ctx, event) => {
    console.log('Daily task running');
  }
});
```

### Multiple Triggers

Export an array of triggers from your workflow file:

```typescript
import { Builtin } from "floww";

const builtin = new Builtin();

export default [
  builtin.triggers.onWebhook({
    path: '/deploy',
    handler: async (ctx, event) => {
      // Handle deployments
    },
  }),

  builtin.triggers.onCron({
    expression: "0 */2 * * *",  // Every 2 hours
    handler: async (ctx, event) => {
      // Cleanup tasks
    },
  }),
];
```

## AI & LLMs

Floww has first-class AI support with the Vercel AI SDK integration.

```typescript
import { OpenAI, Builtin } from "floww";
import { generateText } from "floww/ai";
import { z } from "zod";

const openai = new OpenAI();
const builtin = new Builtin();

builtin.triggers.onWebhook({
  path: '/chat',
  handler: async (ctx, event) => {
    const result = await generateText({
      model: openai.models.gpt4oMini,
      prompt: event.body.message,
      tools: {
        getWeather: {
          description: "Get current weather",
          inputSchema: z.object({ city: z.string() }),
          execute: async ({ city }) => {
            // Your weather API call
            return { temp: 72, condition: 'sunny' };
          }
        }
      }
    });

    return { response: result.text };
  }
});
```

[See full AI example →](./examples/4_ai/main.ts)

## Provider Configuration

### Automatic Provider Detection

Floww automatically detects which providers you're using in your code. When you run `floww dev` or `floww deploy`, you will be prompted to create those that don't exist yet


### Using Multiple Provider Instances

You can have multiple instances of the same provider in your namespace by using different aliases:

```typescript
import { Gitlab, OpenAI } from "floww";

// Personal GitLab account
const gitlabPersonal = new Gitlab("personal");

// Work GitLab account
const gitlabWork = new Gitlab("work");

// Different OpenAI projects
const openaiDev = new OpenAI("development");
const openaiProd = new OpenAI("production");
```

Each alias is configured separately with its own credentials.


### Available Providers
- `builtin` - Webhooks and cron (no auth required)
- `gitlab` - GitLab events and API
- `google_calendar` - Google Calendar events
- `openai` - AI models (GPT-4, GPT-3.5, etc.)
- `anthropic` - Claude models
- `slack` - Slack events and messaging

[See all providers →](https://usefloww.dev/docs/providers)

## Providers

### GitLab

```typescript
import { Gitlab } from "floww";

const gitlab = new Gitlab({
  token: process.env.GITLAB_TOKEN
});

gitlab.triggers.onPushEvent({
  handler: (ctx, event) => {
    console.log('Push to', event.ref);
  }
});
```

### Google Calendar

```typescript
import { GoogleCalendar } from "floww";

const calendar = new GoogleCalendar({
  email: "user@example.com"
});

calendar.triggers.onEventStart({
  handler: (ctx, event) => {
    console.log('Event starting:', event.title);
  }
});
```

## CLI Commands

### Development Mode

```bash
floww dev [file]        # Run with auto-reload (default: main.ts)
floww dev --port 8080   # Custom port
```

**How it works:**

When you run `floww dev`, the CLI:
1. **Registers your triggers** on the Floww server (webhooks, cron schedules, etc.)
2. **Routes events to your local machine** for execution
3. **Watches for file changes** and hot-reloads your code

This means:
- Your webhooks get real URLs immediately (e.g., `https://app.usefloww.dev/webhook/abc123`)
- Events are executed in your local environment with live code changes
- You can test with real external services (GitLab webhooks, cron schedules, etc.)
- All logging happens in your terminal in real-time

**Example workflow:**
```bash
# Start dev server
floww dev

# Your webhook is registered and you get a URL:
# ✓ Webhook registered: https://app.usefloww.dev/webhook/w_abc123/custom

# Send a request to that URL from anywhere:
curl -X POST https://app.usefloww.dev/webhook/w_abc123/custom \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'

# Event is routed to your local machine and executed
# You see the logs in your terminal immediately
```

**Local-only testing:**

For testing without deploying triggers, you can also use localhost:
```bash
curl -X POST http://localhost:3000/webhooks/custom \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## Deployment

### First Time Setup

1. Create a Floww account at [app.usefloww.dev](https://app.usefloww.dev)

2. Login from CLI:
```bash
floww login
```

3. Deploy your workflow:
```bash
floww deploy
```

This will:
- Bundle your TypeScript code
- Upload to Floww cloud
- Provision infrastructure
- Return a webhook URL

## Documentation

For detailed documentation, visit [usefloww.dev](https://usefloww.dev)

- [Quick Start Guide](https://usefloww.dev/docs/getting-started/quick-start)
- [Running Locally](https://usefloww.dev/docs/running-locally)
- [All Providers](https://usefloww.dev/docs/providers)
- [Architecture](https://usefloww.dev/docs/advanced/architecture)
