import {
  WebhookTrigger,
  Handler,
  WebhookEvent,
  WebhookContext,
} from "../common";
import { BaseProvider, BaseProviderConfig } from "./base";
import { GitLabApi } from "./gitlab/api";

export type GitlabConfig = BaseProviderConfig & {
  baseUrl?: string; // Allow custom GitLab instance URL
};

// GitLab webhook event types
export type GitLabMergeRequestCommentEvent = {
  object_kind: "note";
  user: {
    name: string;
    username: string;
    id: number;
  };
  project: {
    id: number;
    name: string;
  };
  merge_request: {
    id: number;
    iid: number;
    title: string;
  };
  object_attributes: {
    note: string;
    created_at: string;
  };
};

export type GitLabMergeRequestCommentTriggerArgs = {
  projectId?: string;
  groupId?: string;
  handler: Handler<
    WebhookEvent<GitLabMergeRequestCommentEvent>,
    WebhookContext
  >;
};

export class Gitlab extends BaseProvider {
  providerType = "gitlab";

  secretDefinitions = [
    {
      key: "accessToken",
      label: "GitLab Access Token",
      type: "password" as const,
      required: true,
    },
  ];

  constructor(config?: GitlabConfig | string) {
    super(config);
  }

  private getBaseUrl(): string {
    return (
      this.getConfig<string>("baseUrl", "https://gitlab.com") ||
      "https://gitlab.com"
    );
  }

  /**
   * Get a configured GitLab API client
   */
  getApi(): GitLabApi {
    return new GitLabApi({
      baseUrl: this.getBaseUrl(),
      accessToken: this.getSecret("accessToken"),
    });
  }

  actions = {};
  triggers = {
    onMergeRequestComment: (
      args: GitLabMergeRequestCommentTriggerArgs
    ): WebhookTrigger<GitLabMergeRequestCommentEvent> => {
      if (!args.projectId && !args.groupId) {
        throw new Error("Either projectId or groupId must be provided");
      }

      return {
        type: "webhook",
        handler: args.handler,
        // Path will be auto-generated as /webhook/{uuid}
        method: "POST",
        validation: async (event) => {
          // TODO: Implement GitLab webhook signature validation
          return true;
        },
        setup: async (ctx) => {
          const api = this.getApi();

          try {
            let webhook;
            if (args.projectId) {
              webhook = await api.createProjectWebhook(args.projectId, {
                url: ctx.webhookUrl,
                note_events: true, // Enable merge request comments
                merge_requests_events: true,
              });
              console.log(
                `✅ GitLab webhook registered for project ${args.projectId}`
              );

              // Store metadata for teardown
              ctx.setMetadata("webhookId", webhook.id);
              ctx.setMetadata("projectId", args.projectId);
            } else if (args.groupId) {
              webhook = await api.createGroupWebhook(args.groupId, {
                url: ctx.webhookUrl,
                note_events: true,
                merge_requests_events: true,
              });
              console.log(
                `✅ GitLab webhook registered for group ${args.groupId}`
              );

              // Store metadata for teardown
              ctx.setMetadata("webhookId", webhook.id);
              ctx.setMetadata("groupId", args.groupId);
            }
            console.log(`   Webhook URL: ${ctx.webhookUrl}`);
            console.log(`   Webhook ID: ${webhook?.id}`);
          } catch (error: any) {
            console.error(
              "❌ Failed to register GitLab webhook:",
              error.message
            );
            throw error;
          }
        },
        teardown: async (ctx) => {
          const api = this.getApi();
          const webhookId = ctx.getMetadata("webhookId");
          const projectId = ctx.getMetadata("projectId");
          const groupId = ctx.getMetadata("groupId");

          if (!webhookId) {
            console.log("⚠️  No webhook ID found, skipping cleanup");
            return;
          }

          try {
            if (projectId) {
              await api.deleteProjectWebhook(projectId, webhookId);
              console.log(
                `🗑️  GitLab webhook ${webhookId} deleted from project ${projectId}`
              );
            } else if (groupId) {
              await api.deleteGroupWebhook(groupId, webhookId);
              console.log(
                `🗑️  GitLab webhook ${webhookId} deleted from group ${groupId}`
              );
            }
          } catch (error: any) {
            console.error("❌ Failed to delete GitLab webhook:", error.message);
            // Don't throw - allow graceful shutdown even if cleanup fails
          }
        },
      };
    },
  };
}
