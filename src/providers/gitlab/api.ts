export type GitLabApiConfig = {
  baseUrl: string;
  accessToken: string;
};

export type GitLabWebhook = {
  id: number;
  url: string;
  project_id?: number;
  group_id?: number;
  push_events: boolean;
  issues_events: boolean;
  merge_requests_events: boolean;
  note_events: boolean;
  [key: string]: any;
};

export type CreateWebhookOptions = {
  projectId?: string;
  groupId?: string;
  url: string;
  token?: string;
  push_events?: boolean;
  issues_events?: boolean;
  merge_requests_events?: boolean;
  note_events?: boolean;
  [key: string]: any;
};

export class GitLabApi {
  private baseUrl: string;
  private accessToken: string;

  constructor(config: GitLabApiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.accessToken = config.accessToken;
  }

  private async request<T = any>(
    method: string,
    path: string,
    body?: any,
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v4${path}`;

    const headers: Record<string, string> = {
      "PRIVATE-TOKEN": this.accessToken,
      "Content-Type": "application/json",
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
      throw new Error(`GitLab API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  async get<T = any>(path: string): Promise<T> {
    return this.request<T>("GET", path) as Promise<T>;
  }

  async post<T = any>(path: string, body?: any): Promise<T> {
    return this.request<T>("POST", path, body) as Promise<T>;
  }

  async put<T = any>(path: string, body?: any): Promise<T> {
    return this.request<T>("PUT", path, body) as Promise<T>;
  }

  async delete<T = any>(path: string): Promise<T> {
    return this.request<T>("DELETE", path) as Promise<T>;
  }

  // Webhook operations
  async createProjectWebhook(
    projectId: string,
    options: Omit<CreateWebhookOptions, "projectId" | "groupId">,
  ): Promise<GitLabWebhook> {
    return this.post(`/projects/${encodeURIComponent(projectId)}/hooks`, {
      url: options.url,
      token: options.token,
      push_events: options.push_events ?? false,
      issues_events: options.issues_events ?? false,
      merge_requests_events: options.merge_requests_events ?? false,
      note_events: options.note_events ?? false,
      ...options,
    });
  }

  async createGroupWebhook(
    groupId: string,
    options: Omit<CreateWebhookOptions, "projectId" | "groupId">,
  ): Promise<GitLabWebhook> {
    return this.post(`/groups/${encodeURIComponent(groupId)}/hooks`, {
      url: options.url,
      token: options.token,
      push_events: options.push_events ?? false,
      issues_events: options.issues_events ?? false,
      merge_requests_events: options.merge_requests_events ?? false,
      note_events: options.note_events ?? false,
      ...options,
    });
  }

  async listProjectWebhooks(projectId: string): Promise<GitLabWebhook[]> {
    return this.get(`/projects/${encodeURIComponent(projectId)}/hooks`);
  }

  async listGroupWebhooks(groupId: string): Promise<GitLabWebhook[]> {
    return this.get(`/groups/${encodeURIComponent(groupId)}/hooks`);
  }

  async deleteProjectWebhook(projectId: string, hookId: number): Promise<void> {
    return this.delete(
      `/projects/${encodeURIComponent(projectId)}/hooks/${hookId}`,
    );
  }

  async deleteGroupWebhook(groupId: string, hookId: number): Promise<void> {
    return this.delete(
      `/groups/${encodeURIComponent(groupId)}/hooks/${hookId}`,
    );
  }

  // Project operations
  async getProject(projectId: string): Promise<any> {
    return this.get(`/projects/${encodeURIComponent(projectId)}`);
  }

  async listProjects(): Promise<any[]> {
    return this.get("/projects");
  }

  // Merge request operations
  async getMergeRequest(
    projectId: string,
    mergeRequestIid: number,
  ): Promise<any> {
    return this.get(
      `/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}`,
    );
  }

  async listMergeRequests(projectId: string): Promise<any[]> {
    return this.get(
      `/projects/${encodeURIComponent(projectId)}/merge_requests`,
    );
  }

  // Issues operations
  async getIssue(projectId: string, issueIid: number): Promise<any> {
    return this.get(
      `/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`,
    );
  }

  async listIssues(projectId: string): Promise<any[]> {
    return this.get(`/projects/${encodeURIComponent(projectId)}/issues`);
  }
}
