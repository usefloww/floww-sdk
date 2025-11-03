# Jira Example

This example demonstrates how to use the Jira provider in Flows to receive and log Jira webhook events.

## Features

This example showcases:

1. **Issue Created Events** - Log when new issues are created
2. **Issue Updated Events** - Log when issues are updated (including what changed)
3. **Comment Added Events** - Log when comments are added to issues

## Prerequisites

### 1. Jira Cloud Instance

You need access to a Jira Cloud instance (e.g., `https://your-domain.atlassian.net`).

### 2. Jira API Token

Create an API token for authentication:

1. Go to [https://id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a name (e.g., "Flows Integration")
4. Copy the generated token (you won't be able to see it again)

### 3. Configure the Provider

When running this workflow, you'll be prompted to configure the Jira provider with:

- **Instance URL**: Your Jira Cloud URL (e.g., `https://your-domain.atlassian.net`)
- **Email**: Your Atlassian account email
- **API Token**: The token you created above

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Optional: Filter by Project

If you want to only receive events from a specific project, you can add the `projectKey` parameter:

```typescript
jira.triggers.onIssueCreated({
  projectKey: "YOUR_PROJECT_KEY", // Optional filter
  handler: async (ctx, event) => {
    // ...
  },
});
```

## Running the Example

### Local Development

```bash
npm run floww-local
```

### Deploy to Flows

```bash
npm run floww deploy
```

## Webhooks

This example uses Jira webhooks to trigger workflows when:

- New issues are created (`onIssueCreated`)
- Issues are updated (`onIssueUpdated`)
- Comments are added (`onCommentAdded`)

The webhooks are automatically registered with Jira when you deploy the workflow.

## Example Output

When an issue is created, you'll see output like:

```
=== New Issue Created ===
Key: ENG-123
Summary: Fix login bug
Type: Bug
Status: To Do
Project: Engineering (ENG)
Reporter: John Doe
Created: 2024-11-03T10:30:00.000Z
Priority: High
========================
```

When an issue is updated:

```
=== Issue Updated ===
Key: ENG-123
Summary: Fix login bug
Updated by: Jane Smith

Changes:
  - status: To Do → In Progress
  - assignee: (none) → Jane Smith
====================
```

When a comment is added:

```
=== Comment Added ===
Issue: ENG-123 - Fix login bug
Commenter: Bob Johnson
Created: 2024-11-03T11:00:00.000Z
Comment: I've started investigating this issue. Will provide an update in 2 hours.
====================
```

## Jira REST API

This example uses the Jira Cloud REST API v3. For more information, see:
- [Jira REST API Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [JQL Documentation](https://www.atlassian.com/software/jira/guides/expand-jira/jql)
- [Webhooks Documentation](https://developer.atlassian.com/server/jira/platform/webhooks/)

## Extending This Example

Once you understand the event structure, you can extend this example to:

- **Auto-comment** on new issues with triage information
- **Send notifications** to Slack when high-priority issues are created
- **Auto-assign** issues based on labels or components
- **Sync** Jira issues with other systems (GitHub, GitLab, etc.)
- **Search** for related issues and link them automatically
- **Transition** issues through your workflow automatically
- **Create** new issues programmatically

The Jira provider includes actions for:
- `jira.actions.createIssue()` - Create new issues
- `jira.actions.updateIssue()` - Update issue fields
- `jira.actions.addComment()` - Add comments
- `jira.actions.transitionIssue()` - Move issues between states
- `jira.actions.searchIssues()` - Search with JQL
- And more!

## Troubleshooting

### Authentication Errors

- Ensure your API token is valid and hasn't expired
- Verify the email matches your Atlassian account
- Check that your account has permission to access the project

### Webhook Issues

- Webhooks are registered automatically when the workflow is deployed
- Check the Jira webhook settings at: `https://your-domain.atlassian.net/plugins/servlet/webhooks`
- Ensure your Flows backend is accessible from the internet

## Learn More

- [Flows Documentation](https://docs.flows.com)
- [Jira Cloud REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Other Examples](../)
