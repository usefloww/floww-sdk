import type {
  Task,
  CreateTaskOptions,
  UpdateTaskOptions,
  GetTasksFilters,
  MoveTaskOptions,
  QuickAddTaskOptions,
  QuickAddResult,
  TodoistApiConfig,
} from "./types";

/**
 * Todoist REST API v2 Client
 * https://developer.todoist.com/rest/v2/
 */
export class TodoistApi {
  private readonly apiToken: string;
  private readonly baseUrl = "https://api.todoist.com/rest/v2";

  constructor(config: TodoistApiConfig) {
    this.apiToken = config.apiToken;
  }

  /**
   * Make an authenticated request to the Todoist API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: any,
    queryParams?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    // Add query parameters if provided
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.append(key, value);
        }
      });
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);

    // Handle no content responses (e.g., DELETE operations)
    if (response.status === 204) {
      return undefined as T;
    }

    const data: any = await response.json();

    if (!response.ok) {
      throw new Error(
        `Todoist API error (${response.status}): ${
          data.error || data.message || "Unknown error"
        }`
      );
    }

    return data as T;
  }

  /**
   * Get a task by ID
   * https://developer.todoist.com/rest/v2/#get-an-active-task
   */
  async getTask(taskId: string): Promise<Task> {
    return this.request<Task>("GET", `/tasks/${taskId}`);
  }

  /**
   * Get multiple tasks with optional filters
   * https://developer.todoist.com/rest/v2/#get-active-tasks
   */
  async getTasks(filters?: GetTasksFilters): Promise<Task[]> {
    const queryParams: Record<string, string> = {};

    if (filters) {
      if (filters.project_id) queryParams.project_id = filters.project_id;
      if (filters.section_id) queryParams.section_id = filters.section_id;
      if (filters.label) queryParams.label = filters.label;
      if (filters.filter) queryParams.filter = filters.filter;
      if (filters.lang) queryParams.lang = filters.lang;
      if (filters.ids) queryParams.ids = filters.ids;
      if (filters.parent_id) queryParams.parent_id = filters.parent_id;
    }

    return this.request<Task[]>("GET", "/tasks", undefined, queryParams);
  }

  /**
   * Create a new task
   * https://developer.todoist.com/rest/v2/#create-a-new-task
   */
  async createTask(options: CreateTaskOptions): Promise<Task> {
    const body: Record<string, any> = {
      content: options.content,
    };

    // Add optional fields
    if (options.description) body.description = options.description;
    if (options.project_id) body.project_id = options.project_id;
    if (options.section_id) body.section_id = options.section_id;
    if (options.parent_id) body.parent_id = options.parent_id;
    if (options.order !== undefined) body.order = options.order;
    if (options.labels && options.labels.length > 0) body.labels = options.labels;
    if (options.priority) body.priority = options.priority;
    if (options.assignee_id) body.assignee_id = options.assignee_id;

    // Handle due date options
    if (options.due_string) {
      body.due_string = options.due_string;
      if (options.due_lang) body.due_lang = options.due_lang;
    } else if (options.due_datetime) {
      body.due_datetime = options.due_datetime;
    } else if (options.due_date) {
      body.due_date = options.due_date;
    }

    // Handle duration
    if (options.duration !== undefined && options.duration_unit) {
      body.duration = options.duration;
      body.duration_unit = options.duration_unit;
    }

    // Handle deadline
    if (options.deadline) {
      body.deadline = options.deadline;
    }

    return this.request<Task>("POST", "/tasks", body);
  }

  /**
   * Update an existing task
   * https://developer.todoist.com/rest/v2/#update-a-task
   */
  async updateTask(taskId: string, options: UpdateTaskOptions): Promise<Task> {
    const body: Record<string, any> = {};

    // Add optional fields if provided
    if (options.content !== undefined) body.content = options.content;
    if (options.description !== undefined) body.description = options.description;
    if (options.labels !== undefined) body.labels = options.labels;
    if (options.priority !== undefined) body.priority = options.priority;
    if (options.assignee_id !== undefined) body.assignee_id = options.assignee_id;

    // Handle due date updates
    if (options.due_string !== undefined) {
      body.due_string = options.due_string;
      if (options.due_lang) body.due_lang = options.due_lang;
    } else if (options.due_datetime !== undefined) {
      body.due_datetime = options.due_datetime;
    } else if (options.due_date !== undefined) {
      body.due_date = options.due_date;
    }

    // Handle duration updates
    if (options.duration !== undefined && options.duration_unit !== undefined) {
      body.duration = options.duration;
      body.duration_unit = options.duration_unit;
    }

    // Handle deadline updates
    if (options.deadline !== undefined) {
      body.deadline = options.deadline;
    }

    return this.request<Task>("POST", `/tasks/${taskId}`, body);
  }

  /**
   * Delete a task
   * https://developer.todoist.com/rest/v2/#delete-a-task
   */
  async deleteTask(taskId: string): Promise<void> {
    await this.request<void>("DELETE", `/tasks/${taskId}`);
  }

  /**
   * Close (complete) a task
   * https://developer.todoist.com/rest/v2/#close-a-task
   */
  async closeTask(taskId: string): Promise<void> {
    await this.request<void>("POST", `/tasks/${taskId}/close`);
  }

  /**
   * Reopen a completed task
   * https://developer.todoist.com/rest/v2/#reopen-a-task
   */
  async reopenTask(taskId: string): Promise<void> {
    await this.request<void>("POST", `/tasks/${taskId}/reopen`);
  }

  /**
   * Move a task to a different project/section
   * Note: The Todoist API doesn't have a dedicated "move" endpoint.
   * We accomplish this by updating the task's project_id and section_id.
   */
  async moveTask(taskId: string, options: MoveTaskOptions): Promise<Task> {
    const body: Record<string, any> = {
      project_id: options.project_id,
    };

    if (options.section_id) {
      body.section_id = options.section_id;
    }

    if (options.parent_id) {
      body.parent_id = options.parent_id;
    }

    return this.request<Task>("POST", `/tasks/${taskId}`, body);
  }

  /**
   * Quick add a task using natural language
   * https://developer.todoist.com/rest/v2/#quick-add-a-task
   */
  async quickAddTask(options: QuickAddTaskOptions): Promise<Task> {
    const body: Record<string, any> = {
      text: options.text,
    };

    if (options.note) body.note = options.note;
    if (options.reminder) body.reminder = options.reminder;
    if (options.auto_reminder !== undefined) {
      body.auto_reminder = options.auto_reminder;
    }

    // The quick add endpoint returns a different structure
    const result = await this.request<QuickAddResult>(
      "POST",
      "/quick/add",
      body
    );

    return result.task;
  }
}
