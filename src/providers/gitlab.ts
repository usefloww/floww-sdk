import {
  WebhookTrigger,
  Handler,
  WebhookEvent,
  WebhookContext,
  WebhookSetupContext,
  WebhookTeardownContext,
} from "../common";
import { BaseProvider, BaseProviderConfig } from "./base";
import { GitLabApi } from "./gitlab/api";
import { registerTrigger } from "../userCode/providers";

export type GitlabConfig = BaseProviderConfig & {
  baseUrl?: string; // Allow custom GitLab instance URL
};

// GitLab webhook event types
export type GitLabMergeRequestEvent = {
  object_kind: "merge_request";
  event_type: "merge_request";
  user: {
    id: number;
    name: string;
    username: string;
    avatar_url: string;
    email?: string;
  };
  project: {
    id: number;
    name: string;
    description: string;
    web_url: string;
    avatar_url?: string;
    git_ssh_url: string;
    git_http_url: string;
    namespace: string;
    visibility_level: number;
    path_with_namespace: string;
    default_branch: string;
    ci_config_path?: string;
    homepage: string;
    url: string;
    ssh_url: string;
    http_url: string;
  };
  repository: {
    name: string;
    url: string;
    description: string;
    homepage: string;
  };
  object_attributes: {
    id: number;
    iid: number;
    title: string;
    description: string;
    state: string;
    action: string;
    author_id: number;
    assignee_id?: number;
    assignee_ids?: number[];
    reviewer_ids?: number[];
    source_branch: string;
    target_branch: string;
    source_project_id: number;
    target_project_id: number;
    merge_status: string;
    detailed_merge_status: string;
    merge_when_pipeline_succeeds: boolean;
    merge_commit_sha: string | null;
    merge_error: string | null;
    created_at: string;
    updated_at: string;
    prepared_at?: string;
    updated_by_id?: number;
    head_pipeline_id?: number;
    blocking_discussions_resolved: boolean;
    first_contribution: boolean;
    last_edited_at?: string | null;
    last_edited_by_id?: number | null;
    merge_params?: Record<string, any>;
    time_estimate: number;
    total_time_spent: number;
    human_time_change?: string | null;
    human_time_estimate?: string | null;
    human_total_time_spent?: string | null;
    draft: boolean;
    work_in_progress: boolean;
    url: string;
    source: Omit<GitLabMergeRequestEvent["project"], "visibility_level">;
    target: Omit<GitLabMergeRequestEvent["project"], "visibility_level">;
    last_commit: {
      id: string;
      message: string;
      title: string;
      timestamp: string;
      url: string;
      author: {
        name: string;
        email: string;
      };
    };
    approval_rules?: any[];
  };
  labels: {
    id?: number;
    title?: string;
    color?: string;
  }[];
  changes?: Record<string, any>;
  assignees: {
    id: number;
    name: string;
    username: string;
    avatar_url: string;
    email?: string;
  }[];
  reviewers: {
    id: number;
    name: string;
    username: string;
    avatar_url: string;
    email?: string;
    state: string;
    re_requested: boolean;
  }[];
};

export type GitLabMergeRequestTriggerArgs = {
  projectId?: string;
  groupId?: string;
  handler: Handler<WebhookEvent<GitLabMergeRequestEvent>, WebhookContext>;
};

export class Gitlab extends BaseProvider {
  constructor(config?: GitlabConfig | string) {
    super("gitlab", config);
  }

  actions = {};
  triggers = {
    onMergeRequest: (
      args: GitLabMergeRequestTriggerArgs
    ): WebhookTrigger<GitLabMergeRequestEvent> => {
      if (!args.projectId && !args.groupId) {
        throw new Error("Either projectId or groupId must be provided");
      }

      const triggerInput = args.projectId
        ? { projectId: args.projectId }
        : { groupId: args.groupId };

      return registerTrigger(
        {
          type: "webhook",
          handler: args.handler,
          // Path will be auto-generated as /webhook/{uuid}
          method: "POST",
          validation: async (event: WebhookEvent) => {
            // TODO: Implement GitLab webhook signature validation
            return true;
          },
          setup: async (ctx: WebhookSetupContext) => {},
          teardown: async (ctx: WebhookTeardownContext) => {},
        },
        {
          type: this.providerType,
          alias: this.credentialName,
          triggerType: "onMergeRequestComment",
          input: triggerInput,
        }
      );
    },
  };
}
