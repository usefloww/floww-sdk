import { BaseProvider, BaseProviderConfig } from "./base";
import { TodoistApi } from "./todoist/api";
import type {
  Task,
  CreateTaskOptions,
  UpdateTaskOptions,
  GetTasksFilters,
  MoveTaskOptions,
  QuickAddTaskOptions,
} from "./todoist/types";

export type TodoistConfig = BaseProviderConfig & {
  api_token?: string;
};

/**
 * Actions class for Todoist task operations
 */
class TodoistActions {
  constructor(private getApi: () => TodoistApi) {}

  /**
   * Get a single task by ID
   * @param args.taskId The task ID
   * @returns The task object
   */
  async getTask(args: { taskId: string }): Promise<Task> {
    const api = this.getApi();
    return await api.getTask(args.taskId);
  }

  /**
   * Get multiple tasks with optional filters
   * @param args.filters Optional filters (project_id, section_id, label, etc.)
   * @returns Array of tasks
   */
  async getTasks(args?: { filters?: GetTasksFilters }): Promise<Task[]> {
    const api = this.getApi();
    return await api.getTasks(args?.filters);
  }

  /**
   * Create a new task
   * @param args Task creation options
   * @returns The created task
   */
  async createTask(args: CreateTaskOptions): Promise<Task> {
    const api = this.getApi();
    return await api.createTask(args);
  }

  /**
   * Update an existing task
   * @param args.taskId The task ID
   * @param args.updates Fields to update
   * @returns The updated task
   */
  async updateTask(args: {
    taskId: string;
    updates: UpdateTaskOptions;
  }): Promise<Task> {
    const api = this.getApi();
    return await api.updateTask(args.taskId, args.updates);
  }

  /**
   * Delete a task
   * @param args.taskId The task ID
   */
  async deleteTask(args: { taskId: string }): Promise<void> {
    const api = this.getApi();
    return await api.deleteTask(args.taskId);
  }

  /**
   * Close (complete) a task
   * @param args.taskId The task ID
   */
  async closeTask(args: { taskId: string }): Promise<void> {
    const api = this.getApi();
    return await api.closeTask(args.taskId);
  }

  /**
   * Reopen a completed task
   * @param args.taskId The task ID
   */
  async reopenTask(args: { taskId: string }): Promise<void> {
    const api = this.getApi();
    return await api.reopenTask(args.taskId);
  }

  /**
   * Move a task to a different project/section
   * @param args.taskId The task ID
   * @param args.destination Destination project and optional section/parent
   * @returns The updated task
   */
  async moveTask(args: {
    taskId: string;
    destination: MoveTaskOptions;
  }): Promise<Task> {
    const api = this.getApi();
    return await api.moveTask(args.taskId, args.destination);
  }

  /**
   * Quick add a task using natural language
   * @param args Quick add options with natural language text
   * @returns The created task
   */
  async quickAddTask(args: QuickAddTaskOptions): Promise<Task> {
    const api = this.getApi();
    return await api.quickAddTask(args);
  }
}

/**
 * Todoist Provider
 *
 * Provides integration with Todoist task management API.
 * Supports all core task operations including create, read, update, delete,
 * complete, reopen, move, and quick add.
 *
 * @example
 * ```typescript
 * import { Todoist } from "@DeveloperFlows/floww-sdk";
 *
 * const todoist = new Todoist({
 *   api_token: "your-api-token",
 * });
 *
 * // Create a task
 * const task = await todoist.actions.createTask({
 *   content: "Buy groceries",
 *   priority: 3,
 *   due_string: "tomorrow",
 * });
 *
 * // Complete a task
 * await todoist.actions.closeTask({ taskId: task.id });
 * ```
 */
export class Todoist extends BaseProvider {
  private api?: TodoistApi;
  actions: TodoistActions;
  triggers = {};

  constructor(config?: TodoistConfig | string) {
    super("todoist", config);
    this.actions = new TodoistActions(() => this.getApi());
  }

  private getApi(): TodoistApi {
    if (!this.api) {
      // getSecret() checks: 1) backend secrets, 2) constructor config, 3) env vars
      // and throws a helpful error if not found
      const apiToken = this.getSecret("api_token");

      this.api = new TodoistApi({ apiToken });
    }
    return this.api;
  }
}
