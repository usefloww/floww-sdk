import "floww/testing";
import { describe, it, expect, beforeEach } from "vitest";
import { GitHub } from "../providers/github";
import { Slack } from "../providers/slack";
import { resetAll } from "./reset";
import { clearRegisteredTriggers } from "../userCode/providers";

const github = new GitHub("test-github");
const slack = new Slack("test-slack");

beforeEach(() => {
  resetAll();
  clearRegisteredTriggers();
});

describe("Action spies", () => {
  it("records calls", async () => {
    await github.actions.getIssue({ owner: "org", repo: "repo", issue_number: 1 });
    await github.actions.getIssue({ owner: "org", repo: "repo", issue_number: 2 });

    expect(github.actions.getIssue.calls).toEqual([
      { owner: "org", repo: "repo", issue_number: 1 },
      { owner: "org", repo: "repo", issue_number: 2 },
    ]);
  });

  it("returns undefined by default", async () => {
    const result = await slack.actions.sendMessage({ channel: "#test", text: "hi" });
    expect(result).toBeUndefined();
  });

  it(".returns(value) sets static return", async () => {
    github.actions.getIssue.returns({ state: "open", title: "bug" });

    const result = await github.actions.getIssue({ owner: "org", repo: "repo", issue_number: 1 });
    expect(result).toEqual({ state: "open", title: "bug" });
  });

  it(".returns(fn) sets dynamic return", async () => {
    github.actions.getIssue.returns((args: any) => ({
      state: args.issue_number === 1 ? "open" : "closed",
    }));

    const r1 = await github.actions.getIssue({ owner: "org", repo: "repo", issue_number: 1 });
    const r2 = await github.actions.getIssue({ owner: "org", repo: "repo", issue_number: 2 });

    expect(r1).toEqual({ state: "open" });
    expect(r2).toEqual({ state: "closed" });
  });

  it(".returnsOnce() single-use then fallback", async () => {
    github.actions.getIssue.returns({ state: "closed" });
    github.actions.getIssue.returnsOnce({ state: "open" });

    const r1 = await github.actions.getIssue({ owner: "o", repo: "r", issue_number: 1 });
    const r2 = await github.actions.getIssue({ owner: "o", repo: "r", issue_number: 2 });

    expect(r1).toEqual({ state: "open" });
    expect(r2).toEqual({ state: "closed" });
  });

  it(".reset() clears calls and return config", async () => {
    github.actions.getIssue.returns({ state: "open" });
    await github.actions.getIssue({ owner: "o", repo: "r", issue_number: 1 });

    github.actions.getIssue.reset();

    expect(github.actions.getIssue.calls).toEqual([]);
    const result = await github.actions.getIssue({ owner: "o", repo: "r", issue_number: 1 });
    expect(result).toBeUndefined();
  });

  it("multiple .returnsOnce() drain in order then fall back", async () => {
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
});

describe("Trigger .invoke()", () => {
  it("fires registered handler", async () => {
    github.triggers.onPush({
      owner: "myorg",
      repository: "myrepo",
      handler: async (_ctx, event) => {
        await slack.actions.sendMessage({
          channel: "#deploys",
          text: `Push to ${event.body.ref}`,
        });
      },
    });

    await github.triggers.onPush.invoke({
      body: { ref: "main", commits: [] },
    });

    expect(slack.actions.sendMessage.calls).toEqual([
      { channel: "#deploys", text: "Push to main" },
    ]);
  });

  it("fills webhook event defaults", async () => {
    let receivedEvent: any;
    github.triggers.onPush({
      owner: "org",
      repository: "repo",
      handler: async (_ctx, event) => {
        receivedEvent = event;
      },
    });

    await github.triggers.onPush.invoke({ body: { ref: "main" } });

    expect(receivedEvent.headers).toEqual({});
    expect(receivedEvent.query).toEqual({});
    expect(receivedEvent.method).toBe("POST");
    expect(receivedEvent.path).toBe("/webhook");
    expect(receivedEvent.body).toEqual({ ref: "main" });
  });

  it("fires multiple handlers on same trigger type", async () => {
    const calls: string[] = [];

    github.triggers.onPush({
      owner: "org",
      repository: "repo",
      handler: async () => {
        calls.push("handler1");
      },
    });

    github.triggers.onPush({
      owner: "org",
      repository: "repo2",
      handler: async () => {
        calls.push("handler2");
      },
    });

    await github.triggers.onPush.invoke({ body: {} });

    expect(calls).toEqual(["handler1", "handler2"]);
  });

  it("returns success:true with no handlers", async () => {
    const result = await github.triggers.onPush.invoke({ body: {} });
    expect(result).toEqual({ success: true });
  });

  it("returns error when handler throws", async () => {
    github.triggers.onPush({
      owner: "org",
      repository: "repo",
      handler: async () => {
        throw new Error("handler failed");
      },
    });

    const result = await github.triggers.onPush.invoke({ body: {} });

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error!.message).toBe("handler failed");
  });

  it("does not fire handlers from a different provider alias", async () => {
    const otherGithub = new GitHub("other-github");

    github.triggers.onPush({
      owner: "org",
      repository: "repo",
      handler: async () => {
        await slack.actions.sendMessage({ channel: "#c", text: "wrong" });
      },
    });

    await otherGithub.triggers.onPush.invoke({ body: {} });

    expect(slack.actions.sendMessage.calls).toEqual([]);
  });

  it("works on non-onPush trigger types", async () => {
    let receivedEvent: any;
    github.triggers.onPullRequest({
      owner: "org",
      repository: "repo",
      handler: async (_ctx, event) => {
        receivedEvent = event;
      },
    });

    await github.triggers.onPullRequest.invoke({
      body: { action: "opened", number: 42 },
    });

    expect(receivedEvent.body).toEqual({ action: "opened", number: 42 });
    expect(receivedEvent.method).toBe("POST");
  });
});

describe("resetAll()", () => {
  it("clears calls and return config on all providers", async () => {
    github.actions.getIssue.returns({ state: "open" });
    await github.actions.getIssue({ owner: "o", repo: "r", issue_number: 1 });
    await slack.actions.sendMessage({ channel: "#test", text: "hi" });

    resetAll();

    expect(github.actions.getIssue.calls).toEqual([]);
    expect(slack.actions.sendMessage.calls).toEqual([]);
    const result = await github.actions.getIssue({ owner: "o", repo: "r", issue_number: 1 });
    expect(result).toBeUndefined();
  });

  it("preserves triggers registered at module scope", async () => {
    github.triggers.onPush({
      owner: "org",
      repository: "repo",
      handler: async () => {
        await slack.actions.sendMessage({ channel: "#c", text: "fired" });
      },
    });

    resetAll();

    await github.triggers.onPush.invoke({ body: {} });
    expect(slack.actions.sendMessage.calls).toEqual([
      { channel: "#c", text: "fired" },
    ]);
  });
});

describe("End-to-end workflow test", () => {
  it("conditional slack notification based on issue state", async () => {
    github.actions.getIssue.returns({ state: "open" });

    github.triggers.onPush({
      owner: "myorg",
      repository: "myrepo",
      handler: async (_ctx, event) => {
        const issue = await github.actions.getIssue({
          owner: "myorg",
          repo: "myrepo",
          issue_number: 1,
        });
        if (issue.state === "open") {
          await slack.actions.sendMessage({
            channel: "#deploys",
            text: `Push to ${event.body.ref}`,
          });
        }
      },
    });

    await github.triggers.onPush.invoke({
      body: { ref: "main", commits: [] },
    });

    expect(slack.actions.sendMessage.calls).toEqual([
      { channel: "#deploys", text: "Push to main" },
    ]);
  });

  it("skips slack when issue is closed", async () => {
    github.actions.getIssue.returns({ state: "closed" });

    github.triggers.onPush({
      owner: "myorg",
      repository: "myrepo",
      handler: async (_ctx, _event) => {
        const issue = await github.actions.getIssue({
          owner: "myorg",
          repo: "myrepo",
          issue_number: 1,
        });
        if (issue.state === "open") {
          await slack.actions.sendMessage({
            channel: "#deploys",
            text: "should not fire",
          });
        }
      },
    });

    await github.triggers.onPush.invoke({
      body: { ref: "main", commits: [] },
    });

    expect(slack.actions.sendMessage.calls).toEqual([]);
  });
});
