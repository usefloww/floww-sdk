export type JiraApiConfig = {
  instanceUrl: string; // e.g., "https://your-domain.atlassian.net"
  email: string;
  apiToken: string;
};

// Jira Issue types
export type JiraIssue = {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description?: string | any; // Can be string or ADF (Atlassian Document Format)
    status: {
      id: string;
      name: string;
      statusCategory: {
        id: number;
        key: string;
        name: string;
      };
    };
    issuetype: {
      id: string;
      name: string;
      subtask: boolean;
    };
    project: {
      id: string;
      key: string;
      name: string;
    };
    priority?: {
      id: string;
      name: string;
    };
    assignee?: JiraUser | null;
    reporter?: JiraUser;
    created: string;
    updated: string;
    labels: string[];
    components: JiraComponent[];
    [key: string]: any; // Allow custom fields
  };
  [key: string]: any;
};

export type JiraUser = {
  accountId: string;
  emailAddress?: string;
  displayName: string;
  avatarUrls?: {
    "48x48"?: string;
    "24x24"?: string;
    "16x16"?: string;
    "32x32"?: string;
  };
  [key: string]: any;
};

export type JiraComponent = {
  id: string;
  name: string;
  description?: string;
  [key: string]: any;
};

export type JiraComment = {
  id: string;
  self: string;
  author: JiraUser;
  body: string | any; // Can be string or ADF
  created: string;
  updated: string;
  [key: string]: any;
};

export type JiraTransition = {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
    statusCategory: {
      id: number;
      key: string;
      name: string;
    };
  };
  hasScreen: boolean;
  isGlobal: boolean;
  isInitial: boolean;
  isConditional: boolean;
  [key: string]: any;
};

export type JiraProject = {
  id: string;
  key: string;
  name: string;
  description?: string;
  lead?: JiraUser;
  projectTypeKey: string;
  simplified: boolean;
  style: string;
  isPrivate: boolean;
  [key: string]: any;
};

export type JiraSearchResults = {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
};

export type CreateIssueOptions = {
  projectKey: string;
  summary: string;
  description?: string;
  issueTypeName: string; // e.g., "Bug", "Task", "Story"
  assigneeAccountId?: string;
  priorityName?: string;
  labels?: string[];
  components?: string[]; // Component names
  parentKey?: string; // For subtasks
  [key: string]: any; // Allow custom fields
};

export type UpdateIssueOptions = {
  summary?: string;
  description?: string;
  assigneeAccountId?: string | null; // null to unassign
  priorityName?: string;
  labels?: string[];
  components?: string[];
  [key: string]: any; // Allow custom fields
};

export type SearchIssuesOptions = {
  jql: string;
  startAt?: number;
  maxResults?: number;
  fields?: string[];
  expand?: string[];
};

export class JiraApi {
  private instanceUrl: string;
  private email: string;
  private apiToken: string;

  constructor(config: JiraApiConfig) {
    this.instanceUrl = config.instanceUrl.replace(/\/$/, ""); // Remove trailing slash
    this.email = config.email;
    this.apiToken = config.apiToken;
  }

  private getAuthHeader(): string {
    return `Basic ${Buffer.from(`${this.email}:${this.apiToken}`).toString("base64")}`;
  }

  private async request<T = any>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const url = `${this.instanceUrl}/rest/api/3${path}`;

    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Jira API error (${response.status}): ${errorText}`
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  private async get<T = any>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private async post<T = any>(path: string, body?: any): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async put<T = any>(path: string, body?: any): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  private async delete<T = any>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  // Issue operations
  async getIssue(issueIdOrKey: string, fields?: string[]): Promise<JiraIssue> {
    const params = fields ? `?fields=${fields.join(",")}` : "";
    return this.get(`/issue/${issueIdOrKey}${params}`);
  }

  async createIssue(options: CreateIssueOptions): Promise<JiraIssue> {
    const fields: any = {
      project: {
        key: options.projectKey,
      },
      summary: options.summary,
      issuetype: {
        name: options.issueTypeName,
      },
    };

    if (options.description) {
      fields.description = {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: options.description,
              },
            ],
          },
        ],
      };
    }

    if (options.assigneeAccountId) {
      fields.assignee = { accountId: options.assigneeAccountId };
    }

    if (options.priorityName) {
      fields.priority = { name: options.priorityName };
    }

    if (options.labels && options.labels.length > 0) {
      fields.labels = options.labels;
    }

    if (options.components && options.components.length > 0) {
      fields.components = options.components.map((name) => ({ name }));
    }

    if (options.parentKey) {
      fields.parent = { key: options.parentKey };
    }

    // Add any additional custom fields
    Object.keys(options).forEach((key) => {
      if (
        ![
          "projectKey",
          "summary",
          "description",
          "issueTypeName",
          "assigneeAccountId",
          "priorityName",
          "labels",
          "components",
          "parentKey",
        ].includes(key)
      ) {
        fields[key] = options[key];
      }
    });

    const response = await this.post<{ id: string; key: string; self: string }>(
      "/issue",
      { fields }
    );

    // Fetch and return the full issue
    return this.getIssue(response.key);
  }

  async updateIssue(
    issueIdOrKey: string,
    options: UpdateIssueOptions
  ): Promise<void> {
    const fields: any = {};

    if (options.summary !== undefined) {
      fields.summary = options.summary;
    }

    if (options.description !== undefined) {
      fields.description = {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: options.description,
              },
            ],
          },
        ],
      };
    }

    if (options.assigneeAccountId !== undefined) {
      fields.assignee = options.assigneeAccountId
        ? { accountId: options.assigneeAccountId }
        : null;
    }

    if (options.priorityName !== undefined) {
      fields.priority = { name: options.priorityName };
    }

    if (options.labels !== undefined) {
      fields.labels = options.labels;
    }

    if (options.components !== undefined) {
      fields.components = options.components.map((name) => ({ name }));
    }

    // Add any additional custom fields
    Object.keys(options).forEach((key) => {
      if (
        ![
          "summary",
          "description",
          "assigneeAccountId",
          "priorityName",
          "labels",
          "components",
        ].includes(key)
      ) {
        fields[key] = options[key];
      }
    });

    await this.put(`/issue/${issueIdOrKey}`, { fields });
  }

  async deleteIssue(issueIdOrKey: string): Promise<void> {
    await this.delete(`/issue/${issueIdOrKey}`);
  }

  async searchIssues(options: SearchIssuesOptions): Promise<JiraSearchResults> {
    const body: any = {
      jql: options.jql,
      startAt: options.startAt ?? 0,
      maxResults: options.maxResults ?? 50,
    };

    if (options.fields) {
      body.fields = options.fields;
    }

    if (options.expand) {
      body.expand = options.expand;
    }

    return this.post("/search", body);
  }

  // Comment operations
  async getComments(issueIdOrKey: string): Promise<JiraComment[]> {
    const response = await this.get<{ comments: JiraComment[] }>(
      `/issue/${issueIdOrKey}/comment`
    );
    return response.comments;
  }

  async addComment(issueIdOrKey: string, commentText: string): Promise<JiraComment> {
    const body = {
      body: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: commentText,
              },
            ],
          },
        ],
      },
    };

    return this.post(`/issue/${issueIdOrKey}/comment`, body);
  }

  async updateComment(
    issueIdOrKey: string,
    commentId: string,
    commentText: string
  ): Promise<JiraComment> {
    const body = {
      body: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: commentText,
              },
            ],
          },
        ],
      },
    };

    return this.put(`/issue/${issueIdOrKey}/comment/${commentId}`, body);
  }

  async deleteComment(issueIdOrKey: string, commentId: string): Promise<void> {
    await this.delete(`/issue/${issueIdOrKey}/comment/${commentId}`);
  }

  // Transition operations
  async getTransitions(issueIdOrKey: string): Promise<JiraTransition[]> {
    const response = await this.get<{ transitions: JiraTransition[] }>(
      `/issue/${issueIdOrKey}/transitions`
    );
    return response.transitions;
  }

  async transitionIssue(
    issueIdOrKey: string,
    transitionIdOrName: string
  ): Promise<void> {
    // Get available transitions
    const transitions = await this.getTransitions(issueIdOrKey);

    // Find transition by ID or name
    const transition = transitions.find(
      (t) => t.id === transitionIdOrName || t.name === transitionIdOrName
    );

    if (!transition) {
      throw new Error(
        `Transition "${transitionIdOrName}" not found. Available transitions: ${transitions
          .map((t) => t.name)
          .join(", ")}`
      );
    }

    await this.post(`/issue/${issueIdOrKey}/transitions`, {
      transition: {
        id: transition.id,
      },
    });
  }

  // Project operations
  async getProject(projectIdOrKey: string): Promise<JiraProject> {
    return this.get(`/project/${projectIdOrKey}`);
  }

  async listProjects(): Promise<JiraProject[]> {
    return this.get("/project");
  }

  // Utility: Test connection
  async testConnection(): Promise<{ success: boolean; user?: any }> {
    try {
      const user = await this.get("/myself");
      return { success: true, user };
    } catch (error) {
      return { success: false };
    }
  }
}
