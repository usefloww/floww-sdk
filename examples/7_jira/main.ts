import { Jira } from "floww";

// Initialize Jira provider
const jira = new Jira();

// Example 1: Log when new issues are created
jira.triggers.onIssueCreated({
  handler: async (ctx, event) => {
    console.log("📦 Raw webhook payload:");
    console.log(JSON.stringify(event.body, null, 2));
    console.log("");

    const issue = event.body?.issue;
    if (!issue) {
      console.log("Received issue-created webhook without issue payload");
      console.log("");
      return;
    }

    const fields = issue.fields ?? {};
    const project = fields.project;
    const reporter = event.body?.user;

    console.log("=== New Issue Created ===");
    console.log(`Key: ${issue.key ?? "unknown"}`);
    console.log(`Summary: ${fields.summary ?? "unknown"}`);
    console.log(`Type: ${fields.issuetype?.name ?? "unknown"}`);
    console.log(`Status: ${fields.status?.name ?? "unknown"}`);
    if (project) {
      console.log(`Project: ${project.name} (${project.key})`);
    } else {
      console.log("Project: (not provided in payload)");
    }
    console.log(`Reporter: ${reporter?.displayName ?? "unknown"}`);
    console.log(`Created: ${fields.created ?? "unknown"}`);
    if (fields.assignee) {
      console.log(`Assignee: ${fields.assignee.displayName}`);
    }
    if (fields.priority) {
      console.log(`Priority: ${fields.priority.name}`);
    }
    console.log("========================\n");
  },
});

// Example 2: Log when issues are updated
jira.triggers.onIssueUpdated({
  handler: async (ctx, event) => {
    const issue = event.body.issue;
    const changelog = event.body.changelog;

    console.log("=== Issue Updated ===");
    console.log(`Key: ${issue.key}`);
    console.log(`Summary: ${issue.fields.summary}`);
    console.log(`Updated by: ${event.body.user.displayName}`);

    if (changelog && changelog.items.length > 0) {
      console.log("\nChanges:");
      changelog.items.forEach((change) => {
        const from = change.fromString || change.from || "(none)";
        const to = change.toString || change.to || "(none)";
        console.log(`  - ${change.field}: ${from} → ${to}`);
      });
    }
    console.log("====================\n");
  },
});

// Example 3: Log when comments are added
jira.triggers.onCommentAdded({
  handler: async (ctx, event) => {
    const comment = event.body.comment;
    const issue = event.body.issue;
    const commenter = event.body.user;

    console.log("=== Comment Added ===");
    console.log(`Issue: ${issue.key} - ${issue.fields.summary}`);
    console.log(`Commenter: ${commenter.displayName}`);
    console.log(`Created: ${comment.created}`);

    // Extract text from comment body (may be ADF format)
    const commentText = typeof comment.body === "string"
      ? comment.body
      : JSON.stringify(comment.body);
    console.log(`Comment: ${commentText.substring(0, 200)}${commentText.length > 200 ? "..." : ""}`);
    console.log("====================\n");
  },
});
