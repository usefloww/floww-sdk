import {
  WebhookTrigger,
  Handler,
  WebhookEvent,
  WebhookContext,
} from "../common";
import { BaseProvider, BaseProviderConfig } from "./base";
import {
  JiraApi,
  JiraIssue,
  JiraComment,
  JiraTransition,
  JiraProject,
  JiraSearchResults,
  CreateIssueOptions,
  UpdateIssueOptions,
  SearchIssuesOptions,
} from "./jira/api";
import { registerTrigger } from "../userCode/providers";

export type JiraConfig = BaseProviderConfig & {
  instance_url?: string; // e.g., "https://your-domain.atlassian.net"
  email?: string;
  api_token?: string;
};

// Jira webhook event types
// Reference: https://developer.atlassian.com/server/jira/platform/webhooks/

export type JiraIssueEvent = {
  timestamp: number;
  webhookEvent: string; // e.g., "jira:issue_created", "jira:issue_updated"
  issue_event_type_name?: string; // e.g., "issue_created", "issue_updated"
  user: {
    self: string;
    accountId: string;
    displayName: string;
    avatarUrls: Record<string, string>;
    emailAddress?: string;
  };
  issue: JiraIssue;
  changelog?: {
    id: string;
    items: Array<{
      field: string;
      fieldtype: string;
      from: string | null;
      fromString: string | null;
      to: string | null;
      toString: string | null;
    }>;
  };
};

export type JiraCommentEvent = {
  timestamp: number;
  webhookEvent: string; // "comment_created", "comment_updated", "comment_deleted"
  comment: JiraComment;
  issue: JiraIssue;
  user: {
    self: string;
    accountId: string;
    displayName: string;
    avatarUrls: Record<string, string>;
    emailAddress?: string;
  };
};

export type JiraOnIssueCreatedArgs = {
  projectKey?: string; // Optional: filter by specific project
  issueType?: string; // Optional: filter by issue type (e.g., "Bug", "Task")
  handler: Handler<WebhookEvent<JiraIssueEvent>, WebhookContext>;
};

export type JiraOnIssueUpdatedArgs = {
  projectKey?: string;
  issueType?: string;
  handler: Handler<WebhookEvent<JiraIssueEvent>, WebhookContext>;
};

export type JiraOnCommentAddedArgs = {
  projectKey?: string;
  handler: Handler<WebhookEvent<JiraCommentEvent>, WebhookContext>;
};

// Actions class for Jira operations
class JiraActions {
  constructor(private getApi: () => JiraApi) {}

  // Issue operations
  async getIssue(args: {
    issueIdOrKey: string;
    fields?: string[];
  }): Promise<JiraIssue> {
    const api = this.getApi();
    return await api.getIssue(args.issueIdOrKey, args.fields);
  }

  async createIssue(args: CreateIssueOptions): Promise<JiraIssue> {
    const api = this.getApi();
    return await api.createIssue(args);
  }

  async updateIssue(args: {
    issueIdOrKey: string;
    updates: UpdateIssueOptions;
  }): Promise<void> {
    const api = this.getApi();
    return await api.updateIssue(args.issueIdOrKey, args.updates);
  }

  async deleteIssue(args: { issueIdOrKey: string }): Promise<void> {
    const api = this.getApi();
    return await api.deleteIssue(args.issueIdOrKey);
  }

  async searchIssues(args: SearchIssuesOptions): Promise<JiraSearchResults> {
    const api = this.getApi();
    return await api.searchIssues(args);
  }

  // Comment operations
  async getComments(args: { issueIdOrKey: string }): Promise<JiraComment[]> {
    const api = this.getApi();
    return await api.getComments(args.issueIdOrKey);
  }

  async addComment(args: {
    issueIdOrKey: string;
    commentText: string;
  }): Promise<JiraComment> {
    const api = this.getApi();
    return await api.addComment(args.issueIdOrKey, args.commentText);
  }

  async updateComment(args: {
    issueIdOrKey: string;
    commentId: string;
    commentText: string;
  }): Promise<JiraComment> {
    const api = this.getApi();
    return await api.updateComment(
      args.issueIdOrKey,
      args.commentId,
      args.commentText
    );
  }

  async deleteComment(args: {
    issueIdOrKey: string;
    commentId: string;
  }): Promise<void> {
    const api = this.getApi();
    return await api.deleteComment(args.issueIdOrKey, args.commentId);
  }

  // Transition operations
  async getTransitions(args: {
    issueIdOrKey: string;
  }): Promise<JiraTransition[]> {
    const api = this.getApi();
    return await api.getTransitions(args.issueIdOrKey);
  }

  async transitionIssue(args: {
    issueIdOrKey: string;
    transitionIdOrName: string;
  }): Promise<void> {
    const api = this.getApi();
    return await api.transitionIssue(
      args.issueIdOrKey,
      args.transitionIdOrName
    );
  }

  // Project operations
  async getProject(args: { projectIdOrKey: string }): Promise<JiraProject> {
    const api = this.getApi();
    return await api.getProject(args.projectIdOrKey);
  }

  async listProjects(): Promise<JiraProject[]> {
    const api = this.getApi();
    return await api.listProjects();
  }

  // Utility operations
  async testConnection(): Promise<{ success: boolean; user?: any }> {
    const api = this.getApi();
    return await api.testConnection();
  }
}

export class Jira extends BaseProvider {
  private api?: JiraApi;
  actions: JiraActions;

  constructor(config?: JiraConfig | string) {
    super("jira", config);
    this.actions = new JiraActions(() => this.getApi());
  }

  private getApi(): JiraApi {
    if (!this.api) {
      const instanceUrl = this.getConfig("instance_url");
      const email = this.getConfig("email");
      const apiToken = this.getConfig("api_token");

      if (!instanceUrl) {
        throw new Error(
          "Jira instance_url is required. Set it in the provider config."
        );
      }
      if (!email) {
        throw new Error("Jira email is required. Set it in the provider config.");
      }
      if (!apiToken) {
        throw new Error(
          "Jira api_token is required. Set it in the provider config."
        );
      }

      this.api = new JiraApi({
        instanceUrl,
        email,
        apiToken,
      });
    }
    return this.api;
  }

  triggers = {
    /**
     * Triggers when a new issue is created in Jira.
     *
     * The trigger is registered on the backend and filtering is handled server-side.
     *
     * @param args Configuration for the issue created trigger
     * @param args.projectKey Optional: Filter issues from a specific project
     * @param args.issueType Optional: Filter by issue type (e.g., "Bug", "Task", "Story")
     * @param args.handler Function to handle incoming issue created events
     */
    onIssueCreated: (
      args: JiraOnIssueCreatedArgs
    ): WebhookTrigger<JiraIssueEvent> => {
      return registerTrigger(
        {
          type: "webhook",
          handler: args.handler,
          method: "POST",
        },
        {
          type: this.providerType,
          alias: this.credentialName,
          triggerType: "onIssueCreated",
          input: {
            project_key: args.projectKey,
            issue_type: args.issueType,
          },
        }
      );
    },

    /**
     * Triggers when an issue is updated in Jira.
     *
     * This includes field changes, status transitions, and other modifications.
     *
     * @param args Configuration for the issue updated trigger
     * @param args.projectKey Optional: Filter issues from a specific project
     * @param args.issueType Optional: Filter by issue type
     * @param args.handler Function to handle incoming issue updated events
     */
    onIssueUpdated: (
      args: JiraOnIssueUpdatedArgs
    ): WebhookTrigger<JiraIssueEvent> => {
      return registerTrigger(
        {
          type: "webhook",
          handler: args.handler,
          method: "POST",
        },
        {
          type: this.providerType,
          alias: this.credentialName,
          triggerType: "onIssueUpdated",
          input: {
            project_key: args.projectKey,
            issue_type: args.issueType,
          },
        }
      );
    },

    /**
     * Triggers when a comment is added to an issue in Jira.
     *
     * @param args Configuration for the comment added trigger
     * @param args.projectKey Optional: Filter comments from issues in a specific project
     * @param args.handler Function to handle incoming comment added events
     */
    onCommentAdded: (
      args: JiraOnCommentAddedArgs
    ): WebhookTrigger<JiraCommentEvent> => {
      return registerTrigger(
        {
          type: "webhook",
          handler: args.handler,
          method: "POST",
        },
        {
          type: this.providerType,
          alias: this.credentialName,
          triggerType: "onCommentAdded",
          input: {
            project_key: args.projectKey,
          },
        }
      );
    },
  };
}
