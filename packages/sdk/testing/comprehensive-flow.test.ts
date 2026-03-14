import "./index";
import { describe, it, expect, beforeEach } from "vitest";
import { GitHub } from "../providers/github";
import { Slack } from "../providers/slack";
import { Builtin } from "../providers/builtin";
import { KVStore } from "../providers/kvstore";
import { resetAll } from "./reset";
import { clearRegisteredTriggers } from "../userCode/providers";

const github = new GitHub("bot-github");
const slack = new Slack("bot-slack");
const builtin = new Builtin();
const kv = new KVStore("bot-kv");

beforeEach(() => {
  resetAll();
  clearRegisteredTriggers();
});

// ---------------------------------------------------------------------------
// Flow: GitHub PR Review & Notification Bot
//
// Features tested:
// 1. GitHub onPush trigger
// 2. GitHub onPullRequest trigger
// 3. GitHub onIssue trigger
// 4. GitHub onIssueComment trigger
// 5. Builtin onCron trigger
// 6. Builtin onWebhook trigger
// 7. Builtin onManual trigger
// 8. Slack actions (sendMessage)
// 9. GitHub actions (getIssue, createComment, addLabels, listPullRequests)
// 10. Action spy .returns(), .returnsOnce(), .calls
// 11. Multiple handlers on the same trigger type
// 12. Provider alias isolation
// 13. Error handling in handlers
// ---------------------------------------------------------------------------

describe("GitHub PR Review Bot - Push triggers", () => {
  it("notifies Slack on push to main branch", async () => {
    github.triggers.onPush({
      owner: "acme",
      repository: "app",
      handler: async (_ctx, event) => {
        const ref = event.body.ref;
        if (ref === "refs/heads/main") {
          await slack.actions.sendMessage({
            channel: "#deployments",
            text: `New push to main by ${event.body.pusher?.name ?? "unknown"}`,
          });
        }
      },
    });

    await github.triggers.onPush.invoke({
      body: { ref: "refs/heads/main", pusher: { name: "alice" }, commits: [] },
    });

    expect(slack.actions.sendMessage.calls).toEqual([
      { channel: "#deployments", text: "New push to main by alice" },
    ]);
  });

  it("ignores pushes to non-main branches", async () => {
    github.triggers.onPush({
      owner: "acme",
      repository: "app",
      handler: async (_ctx, event) => {
        if (event.body.ref === "refs/heads/main") {
          await slack.actions.sendMessage({
            channel: "#deployments",
            text: "push to main",
          });
        }
      },
    });

    await github.triggers.onPush.invoke({
      body: { ref: "refs/heads/feature/xyz", commits: [] },
    });

    expect(slack.actions.sendMessage.calls).toEqual([]);
  });
});

describe("GitHub PR Review Bot - Pull request triggers", () => {
  it("auto-labels PR based on file paths", async () => {
    github.actions.listPullRequestFiles.returns([
      { filename: "src/api/users.ts" },
      { filename: "src/api/auth.ts" },
    ]);

    github.triggers.onPullRequest({
      owner: "acme",
      repository: "app",
      handler: async (_ctx, event) => {
        if (event.body.action !== "opened") return;

        const files = await github.actions.listPullRequestFiles({
          owner: "acme",
          repo: "app",
          pull_number: event.body.number,
        });

        const labels: string[] = [];
        if (files.some((f: any) => f.filename.startsWith("src/api/"))) {
          labels.push("api");
        }
        if (files.some((f: any) => f.filename.endsWith(".test.ts"))) {
          labels.push("has-tests");
        }

        if (labels.length > 0) {
          await github.actions.addLabels({
            owner: "acme",
            repo: "app",
            issue_number: event.body.number,
            labels,
          });
        }
      },
    });

    await github.triggers.onPullRequest.invoke({
      body: { action: "opened", number: 42 },
    });

    expect(github.actions.listPullRequestFiles.calls).toEqual([
      { owner: "acme", repo: "app", pull_number: 42 },
    ]);
    expect(github.actions.addLabels.calls).toEqual([
      { owner: "acme", repo: "app", issue_number: 42, labels: ["api"] },
    ]);
  });

  it("posts welcome comment on first-time contributor PR", async () => {
    github.actions.listPullRequests.returnsOnce([]);

    github.triggers.onPullRequest({
      owner: "acme",
      repository: "app",
      handler: async (_ctx, event) => {
        if (event.body.action !== "opened") return;

        const previousPRs = await github.actions.listPullRequests({
          owner: "acme",
          repo: "app",
          state: "all",
          creator: event.body.pull_request?.user?.login,
        });

        if (previousPRs.length === 0) {
          await github.actions.createComment({
            owner: "acme",
            repo: "app",
            issue_number: event.body.number,
            body: `Welcome @${event.body.pull_request?.user?.login}! Thanks for your first contribution.`,
          });
        }
      },
    });

    await github.triggers.onPullRequest.invoke({
      body: {
        action: "opened",
        number: 10,
        pull_request: { user: { login: "newdev" } },
      },
    });

    expect(github.actions.createComment.calls).toEqual([
      {
        owner: "acme",
        repo: "app",
        issue_number: 10,
        body: "Welcome @newdev! Thanks for your first contribution.",
      },
    ]);
  });

  it("skips welcome for returning contributors", async () => {
    github.actions.listPullRequests.returnsOnce([{ number: 5 }, { number: 7 }]);

    github.triggers.onPullRequest({
      owner: "acme",
      repository: "app",
      handler: async (_ctx, event) => {
        if (event.body.action !== "opened") return;

        const previousPRs = await github.actions.listPullRequests({
          owner: "acme",
          repo: "app",
          state: "all",
          creator: event.body.pull_request?.user?.login,
        });

        if (previousPRs.length === 0) {
          await github.actions.createComment({
            owner: "acme",
            repo: "app",
            issue_number: event.body.number,
            body: "Welcome!",
          });
        }
      },
    });

    await github.triggers.onPullRequest.invoke({
      body: {
        action: "opened",
        number: 15,
        pull_request: { user: { login: "veteran" } },
      },
    });

    expect(github.actions.createComment.calls).toEqual([]);
  });
});

describe("GitHub PR Review Bot - Issue triggers", () => {
  it("notifies Slack when critical issue is opened", async () => {
    github.triggers.onIssue({
      owner: "acme",
      repository: "app",
      handler: async (_ctx, event) => {
        if (event.body.action !== "opened") return;

        const labels = event.body.issue?.labels ?? [];
        const isCritical = labels.some(
          (l: any) => l.name === "critical" || l.name === "P0"
        );

        if (isCritical) {
          await slack.actions.sendMessage({
            channel: "#incidents",
            text: `Critical issue #${event.body.issue?.number}: ${event.body.issue?.title}`,
          });
        }
      },
    });

    await github.triggers.onIssue.invoke({
      body: {
        action: "opened",
        issue: {
          number: 99,
          title: "Production database down",
          labels: [{ name: "critical" }, { name: "database" }],
        },
      },
    });

    expect(slack.actions.sendMessage.calls).toEqual([
      {
        channel: "#incidents",
        text: "Critical issue #99: Production database down",
      },
    ]);
  });
});

describe("GitHub PR Review Bot - Multiple handlers on same trigger", () => {
  it("runs labeler and notifier on same PR event", async () => {
    const executionOrder: string[] = [];

    github.actions.listPullRequestFiles.returns([
      { filename: "docs/README.md" },
    ]);

    github.triggers.onPullRequest({
      owner: "acme",
      repository: "app",
      handler: async (_ctx, event) => {
        if (event.body.action !== "opened") return;
        executionOrder.push("labeler");

        const files = await github.actions.listPullRequestFiles({
          owner: "acme",
          repo: "app",
          pull_number: event.body.number,
        });

        if (files.some((f: any) => f.filename.startsWith("docs/"))) {
          await github.actions.addLabels({
            owner: "acme",
            repo: "app",
            issue_number: event.body.number,
            labels: ["documentation"],
          });
        }
      },
    });

    github.triggers.onPullRequest({
      owner: "acme",
      repository: "app",
      handler: async (_ctx, event) => {
        if (event.body.action !== "opened") return;
        executionOrder.push("notifier");

        await slack.actions.sendMessage({
          channel: "#pull-requests",
          text: `New PR #${event.body.number} opened`,
        });
      },
    });

    await github.triggers.onPullRequest.invoke({
      body: { action: "opened", number: 55 },
    });

    expect(executionOrder).toEqual(["labeler", "notifier"]);
    expect(github.actions.addLabels.calls).toHaveLength(1);
    expect(slack.actions.sendMessage.calls).toHaveLength(1);
  });
});

describe("GitHub PR Review Bot - Builtin triggers", () => {
  it("cron: daily stale PR report", async () => {
    github.actions.listPullRequests.returns([
      { number: 1, title: "old PR", updated_at: "2025-01-01T00:00:00Z" },
      { number: 2, title: "recent PR", updated_at: "2026-03-13T00:00:00Z" },
    ]);

    builtin.triggers.onCron({
      expression: "0 9 * * 1-5",
      handler: async (_ctx, _event) => {
        const openPRs = await github.actions.listPullRequests({
          owner: "acme",
          repo: "app",
          state: "open",
        });

        const stalePRs = openPRs.filter((pr: any) => {
          const updatedAt = new Date(pr.updated_at);
          const daysSince =
            (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
          return daysSince > 7;
        });

        if (stalePRs.length > 0) {
          const list = stalePRs
            .map((pr: any) => `- #${pr.number}: ${pr.title}`)
            .join("\n");
          await slack.actions.sendMessage({
            channel: "#dev",
            text: `Stale PRs:\n${list}`,
          });
        }
      },
    });

    await builtin.triggers.onCron.invoke({});

    expect(slack.actions.sendMessage.calls).toHaveLength(1);
    expect(slack.actions.sendMessage.calls[0].text).toContain("#1: old PR");
    expect(slack.actions.sendMessage.calls[0].text).not.toContain("#2: recent PR");
  });

  it("webhook: external CI callback", async () => {
    builtin.triggers.onWebhook({
      handler: async (_ctx, event) => {
        const { status, pr_number, build_url } = event.body;

        if (status === "failure") {
          await github.actions.createComment({
            owner: "acme",
            repo: "app",
            issue_number: pr_number,
            body: `CI failed. [View build](${build_url})`,
          });
        }
      },
    });

    await builtin.triggers.onWebhook.invoke({
      body: {
        status: "failure",
        pr_number: 42,
        build_url: "https://ci.example.com/builds/123",
      },
    });

    expect(github.actions.createComment.calls).toEqual([
      {
        owner: "acme",
        repo: "app",
        issue_number: 42,
        body: "CI failed. [View build](https://ci.example.com/builds/123)",
      },
    ]);
  });

  it("manual: trigger a deployment report", async () => {
    github.actions.listPullRequests.returns([
      { number: 10, title: "Feature A", state: "closed", merged_at: "2026-03-14" },
    ]);

    builtin.triggers.onManual({
      name: "deployment-report",
      description: "Generate a deployment report",
      inputSchema: {
        type: "object",
        properties: {
          since: { type: "string" },
        },
      },
      handler: async (_ctx, event) => {
        const mergedPRs = await github.actions.listPullRequests({
          owner: "acme",
          repo: "app",
          state: "closed",
          sort: "updated",
        });

        await slack.actions.sendMessage({
          channel: "#releases",
          text: `Deployment report: ${mergedPRs.length} PRs merged since ${event.input_data.since}`,
        });
      },
    });

    await builtin.triggers.onManual.invoke({
      input_data: { since: "2026-03-01" },
    });

    expect(slack.actions.sendMessage.calls).toEqual([
      {
        channel: "#releases",
        text: "Deployment report: 1 PRs merged since 2026-03-01",
      },
    ]);
  });
});

describe("GitHub PR Review Bot - Dynamic return values", () => {
  it("returns different issues based on arguments", async () => {
    github.actions.getIssue.returns((args: any) => ({
      number: args.issue_number,
      state: args.issue_number === 1 ? "open" : "closed",
      title: `Issue ${args.issue_number}`,
    }));

    github.triggers.onPush({
      owner: "acme",
      repository: "app",
      handler: async (_ctx, _event) => {
        const issue1 = await github.actions.getIssue({
          owner: "acme",
          repo: "app",
          issue_number: 1,
        });
        const issue2 = await github.actions.getIssue({
          owner: "acme",
          repo: "app",
          issue_number: 2,
        });

        if (issue1.state === "open") {
          await slack.actions.sendMessage({
            channel: "#bugs",
            text: `Open issue: ${issue1.title}`,
          });
        }
        if (issue2.state === "open") {
          await slack.actions.sendMessage({
            channel: "#bugs",
            text: `Open issue: ${issue2.title}`,
          });
        }
      },
    });

    await github.triggers.onPush.invoke({ body: {} });

    expect(slack.actions.sendMessage.calls).toEqual([
      { channel: "#bugs", text: "Open issue: Issue 1" },
    ]);
  });
});

describe("GitHub PR Review Bot - Provider alias isolation", () => {
  it("separate GitHub instances don't share triggers", async () => {
    const orgGithub = new GitHub("org-github");

    github.triggers.onPush({
      owner: "acme",
      repository: "app",
      handler: async () => {
        await slack.actions.sendMessage({ channel: "#c", text: "bot-github" });
      },
    });

    orgGithub.triggers.onPush({
      owner: "org",
      repository: "infra",
      handler: async () => {
        await slack.actions.sendMessage({ channel: "#c", text: "org-github" });
      },
    });

    await github.triggers.onPush.invoke({ body: {} });

    expect(slack.actions.sendMessage.calls).toEqual([
      { channel: "#c", text: "bot-github" },
    ]);
  });
});

describe("GitHub PR Review Bot - Error handling", () => {
  it("handler errors are captured in invoke result", async () => {
    github.triggers.onPush({
      owner: "acme",
      repository: "app",
      handler: async () => {
        throw new Error("API rate limited");
      },
    });

    const result = await github.triggers.onPush.invoke({ body: {} });

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe("API rate limited");
  });

  it("no-op when trigger has no handlers", async () => {
    const result = await github.triggers.onRelease.invoke({ body: {} });
    expect(result).toEqual({ success: true });
  });
});

describe("GitHub PR Review Bot - Issue comment trigger", () => {
  it("responds to /deploy command in comments", async () => {
    github.triggers.onIssueComment({
      owner: "acme",
      repository: "app",
      handler: async (_ctx, event) => {
        const comment = event.body.comment?.body ?? "";
        if (comment.startsWith("/deploy")) {
          const env = comment.split(" ")[1] || "staging";
          await slack.actions.sendMessage({
            channel: "#deployments",
            text: `Deploying PR #${event.body.issue?.number} to ${env}`,
          });
          await github.actions.createComment({
            owner: "acme",
            repo: "app",
            issue_number: event.body.issue?.number,
            body: `Deployment to ${env} initiated.`,
          });
        }
      },
    });

    await github.triggers.onIssueComment.invoke({
      body: {
        action: "created",
        comment: { body: "/deploy production" },
        issue: { number: 42 },
      },
    });

    expect(slack.actions.sendMessage.calls).toEqual([
      { channel: "#deployments", text: "Deploying PR #42 to production" },
    ]);
    expect(github.actions.createComment.calls).toEqual([
      {
        owner: "acme",
        repo: "app",
        issue_number: 42,
        body: "Deployment to production initiated.",
      },
    ]);
  });
});

describe("Spy edge cases", () => {
  it("returnsOnce drains then falls back to returns", async () => {
    github.actions.getIssue.returns({ state: "default" });
    github.actions.getIssue.returnsOnce({ state: "first" });
    github.actions.getIssue.returnsOnce({ state: "second" });

    const r1 = await github.actions.getIssue({ owner: "o", repo: "r", issue_number: 1 });
    const r2 = await github.actions.getIssue({ owner: "o", repo: "r", issue_number: 2 });
    const r3 = await github.actions.getIssue({ owner: "o", repo: "r", issue_number: 3 });

    expect(r1).toEqual({ state: "first" });
    expect(r2).toEqual({ state: "second" });
    expect(r3).toEqual({ state: "default" });
  });

  it("returnsOnce with dynamic function", async () => {
    github.actions.getIssue.returnsOnce((args: any) => ({
      number: args.issue_number,
      computed: true,
    }));

    const result = await github.actions.getIssue({
      owner: "o",
      repo: "r",
      issue_number: 42,
    });

    expect(result).toEqual({ number: 42, computed: true });
  });

  it("calls accumulate across multiple invocations", async () => {
    github.triggers.onPush({
      owner: "acme",
      repository: "app",
      handler: async () => {
        await slack.actions.sendMessage({ channel: "#c", text: "ping" });
      },
    });

    await github.triggers.onPush.invoke({ body: {} });
    await github.triggers.onPush.invoke({ body: {} });

    expect(slack.actions.sendMessage.calls).toHaveLength(2);
  });
});
