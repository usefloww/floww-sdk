# floww/testing

Test Floww workflows without API keys or network access. Actions become spies, triggers get `.invoke()`, and state resets automatically between tests.

## Setup

Add `floww/testing` to your vitest config:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ["floww/testing"],
  },
});
```

That's it. No `beforeEach`, no manual reset — spy state is cleaned automatically between tests.

## Usage

Export your providers from the workflow file, then import them in tests:

```typescript
// main.ts
import { GitHub, Slack } from "floww";

export const github = new GitHub("my-github");
export const slack = new Slack("my-slack");

github.triggers.onPush({
  owner: "myorg",
  repository: "myrepo",
  handler: async (ctx, event) => {
    const issue = await github.actions.getIssue({
      owner: "myorg", repo: "myrepo", issue_number: 1,
    });
    if (issue.state === "open") {
      await slack.actions.sendMessage({
        channel: "#deploys",
        text: `Push to ${event.body.ref}`,
      });
    }
  },
});
```

```typescript
// main.test.ts
import { github, slack } from "./main";

it("notifies slack when issue is open", async () => {
  github.actions.getIssue.returns({ state: "open" });

  await github.triggers.onPush.invoke({
    body: { ref: "main", commits: [] },
  });

  expect(slack.actions.sendMessage.calls).toEqual([
    { channel: "#deploys", text: "Push to main" },
  ]);
});

it("skips when issue is closed", async () => {
  github.actions.getIssue.returns({ state: "closed" });

  await github.triggers.onPush.invoke({
    body: { ref: "main", commits: [] },
  });

  expect(slack.actions.sendMessage.calls).toEqual([]);
});
```

Alternatively, `import "floww/testing"` at the top of your test file instead of using `setupFiles`.

## Action spy API

Each action method on a provider gets these properties:

- **`.calls`** — `any[]` of recorded argument objects
- **`.returns(value | fn)`** — set return value; if a function, called with the action's args
- **`.returnsOnce(value | fn)`** — one-time return, then falls back to the default
- **`.reset()`** — clear calls and return config

```typescript
// Static return
github.actions.getIssue.returns({ state: "open" });

// Dynamic return based on args
github.actions.getIssue.returns((args) => ({
  state: args.issue_number === 1 ? "open" : "closed",
}));

// One-time return, then fall back to default
github.actions.getIssue.returns({ state: "closed" });
github.actions.getIssue.returnsOnce({ state: "open" });
// First call returns "open", subsequent calls return "closed"
```

## Trigger invoke API

Each trigger factory (e.g., `github.triggers.onPush`) gets:

- **`.invoke(partialEvent)`** — fires all registered handlers with the given event data. Returns `Promise<{ success: boolean, error?: Error }>`.

Partial event data is filled with sensible defaults:

| Trigger type | Accepts | Defaults |
|---|---|---|
| WebhookTrigger | `{ body, headers?, query?, method?, path? }` | `headers={}`, `query={}`, `method="POST"`, `path="/webhook"` |
| CronTrigger | `{ scheduledTime?, actualTime? }` | both = `new Date()` |
| ManualTrigger | `{ input_data?, triggered_by? }` | `triggered_by="test-user"` |
| RealtimeTrigger | `{ channel?, type?, payload? }` | `channel="test-channel"` |

## resetAll()

`resetAll()` clears `.calls` and return configs on all provider action spies. It is called automatically via `beforeEach` when using `setupFiles` or `import "floww/testing"`.

You can also call it manually or pass specific providers:

```typescript
import { resetAll } from "floww/testing";

resetAll();                    // reset all providers
resetAll(github, slack);       // reset specific providers
```
