/**
 * Todoist API Types
 * Based on Todoist REST API v2
 */

/**
 * Task priority levels
 * 1 = Normal, 2 = Medium, 3 = High, 4 = Urgent
 */
export type TaskPriority = 1 | 2 | 3 | 4;

/**
 * Duration unit for tasks
 */
export type DurationUnit = "minute" | "day";

/**
 * Due date information for a task
 */
export interface TaskDue {
  /** Due date in YYYY-MM-DD format */
  date: string;
  /** Human readable date string (e.g., "tomorrow", "next Monday") */
  string?: string;
  /** Language code for the string (e.g., "en") */
  lang?: string;
  /** Whether the due date is recurring */
  is_recurring: boolean;
  /** Date and time in RFC3339 format (if time is specified) */
  datetime?: string;
  /** Timezone (if datetime is specified) */
  timezone?: string;
}

/**
 * Duration information for a task
 */
export interface TaskDuration {
  /** Duration amount */
  amount: number;
  /** Duration unit */
  unit: DurationUnit;
}

/**
 * Todoist Task object
 */
export interface Task {
  /** Task ID */
  id: string;
  /** Task content/title */
  content: string;
  /** Task description */
  description: string;
  /** Project ID that the task belongs to */
  project_id: string;
  /** Section ID (if task is in a section) */
  section_id?: string;
  /** Parent task ID (if this is a subtask) */
  parent_id?: string;
  /** Order of the task */
  order: number;
  /** Task priority (1-4) */
  priority: TaskPriority;
  /** Due date information */
  due?: TaskDue;
  /** Array of label names */
  labels: string[];
  /** Number of comments */
  comment_count: number;
  /** User ID who created the task */
  creator_id: string;
  /** Date when task was created */
  created_at: string;
  /** Assigned user ID (for shared tasks) */
  assignee_id?: string;
  /** Assigned user ID who assigned the task */
  assigner_id?: string;
  /** Whether the task is completed */
  is_completed: boolean;
  /** URL to the task */
  url: string;
  /** Task duration */
  duration?: TaskDuration;
  /** Deadline date in YYYY-MM-DD format */
  deadline?: string;
}

/**
 * Options for creating a new task
 */
export interface CreateTaskOptions {
  /** Task content (required) */
  content: string;
  /** Task description */
  description?: string;
  /** Project ID */
  project_id?: string;
  /** Section ID */
  section_id?: string;
  /** Parent task ID */
  parent_id?: string;
  /** Task order */
  order?: number;
  /** Labels */
  labels?: string[];
  /** Priority (1-4) */
  priority?: TaskPriority;
  /** Due date in YYYY-MM-DD format */
  due_date?: string;
  /** Due date and time in RFC3339 format */
  due_datetime?: string;
  /** Human-readable due date string */
  due_string?: string;
  /** Language for due_string (2-letter code) */
  due_lang?: string;
  /** Assignee user ID */
  assignee_id?: string;
  /** Duration amount */
  duration?: number;
  /** Duration unit */
  duration_unit?: DurationUnit;
  /** Deadline date in YYYY-MM-DD format */
  deadline?: string;
}

/**
 * Options for updating a task
 */
export interface UpdateTaskOptions {
  /** Task content */
  content?: string;
  /** Task description */
  description?: string;
  /** Labels */
  labels?: string[];
  /** Priority (1-4) */
  priority?: TaskPriority;
  /** Due date in YYYY-MM-DD format */
  due_date?: string;
  /** Due date and time in RFC3339 format */
  due_datetime?: string;
  /** Human-readable due date string */
  due_string?: string;
  /** Language for due_string (2-letter code) */
  due_lang?: string;
  /** Assignee user ID */
  assignee_id?: string;
  /** Duration amount */
  duration?: number;
  /** Duration unit */
  duration_unit?: DurationUnit;
  /** Deadline date in YYYY-MM-DD format */
  deadline?: string;
}

/**
 * Filters for getting tasks
 */
export interface GetTasksFilters {
  /** Filter by project ID */
  project_id?: string;
  /** Filter by section ID */
  section_id?: string;
  /** Filter by label name */
  label?: string;
  /** Filter query (Todoist filter syntax) */
  filter?: string;
  /** Language for filter string */
  lang?: string;
  /** Comma-separated list of task IDs */
  ids?: string;
  /** Filter by parent task ID */
  parent_id?: string;
}

/**
 * Options for moving a task
 */
export interface MoveTaskOptions {
  /** Destination project ID (required) */
  project_id: string;
  /** Destination section ID */
  section_id?: string;
  /** Destination parent task ID */
  parent_id?: string;
}

/**
 * Options for quick adding a task
 */
export interface QuickAddTaskOptions {
  /** Natural language text for task (required) */
  text: string;
  /** Additional note */
  note?: string;
  /** Reminder in natural language */
  reminder?: string;
  /** Enable auto reminder */
  auto_reminder?: boolean;
}

/**
 * Result from quick add operation
 */
export interface QuickAddResult {
  /** The created task */
  task: Task;
}

/**
 * Configuration for Todoist API client
 */
export interface TodoistApiConfig {
  /** Todoist API token */
  apiToken: string;
}

/**
 * Configuration for Todoist provider
 */
export interface TodoistConfig {
  /** API token (optional if using secrets) */
  api_token?: string;
  /** Credential alias for backend integration */
  credentialName?: string;
}
