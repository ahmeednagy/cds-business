export type Role = "EMPLOYEE" | "MANAGER" | "HR";

export type ItemStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "RETURNED"
  | "APPROVED"
  | "REJECTED"
  | "WITHDRAWN";

export interface Profile {
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  personal_email: string;
  job_title: string;
  department: string;
  hire_date: string | null;
  editable_fields: string[];
}

export interface Me {
  id: number;
  email: string;
  role: Role;
  must_change_password: boolean;
  manager: number | null;
  profile: Profile;
}

export interface Employee {
  id: number;
  email: string;
  role: Role;
  manager: number | null;
  manager_email: string | null;
  is_active: boolean;
  must_change_password: boolean;
  profile: Profile;
  created_at: string;
}

export interface TeamMember {
  id: number;
  email: string;
  role: Role;
  profile: Profile;
  pending_items: number;
}

export interface FieldSpec {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "choice";
  required: boolean;
  choices?: string[];
}

export interface WorkflowStep {
  order: number;
  actor_role: "MANAGER" | "HR";
  require_comment_on_reject: boolean;
  require_comment_on_return: boolean;
}

export interface Workflow {
  id: number;
  name: string;
  is_active: boolean;
  steps: WorkflowStep[];
}

export interface RequestType {
  id: number;
  name: string;
  workflow: number;
  fields_schema: FieldSpec[];
  allow_attachments: boolean;
  require_attachments: boolean;
  is_active: boolean;
}

export interface AttachmentMeta {
  id: number;
  original_name: string;
  content_type: string;
  size: number;
  created_at: string;
}

export interface RequestItem {
  id: number;
  request_type: number;
  request_type_name: string;
  submitter: number;
  submitter_email: string;
  status: ItemStatus;
  current_actor_role: string;
  submitted_at: string;
  values?: Record<string, unknown>;
  comment?: string;
  attachments?: AttachmentMeta[];
  actions?: string[];
  workflow_snapshot?: WorkflowStep[];
}

export interface TimesheetEntry {
  date: string;
  hours: number;
}

export interface TimesheetDay {
  date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  has_open: boolean;
  worked_seconds: number;
  manual_hours: number | null;
}

export interface Timesheet {
  id: number;
  submitter: number;
  submitter_email: string;
  week_start: string;
  status: ItemStatus;
  current_actor_role: string;
  total_hours: number;
  entries?: TimesheetEntry[];
  attendance?: AttendanceSession[];
  attendance_hours?: number;
  days?: TimesheetDay[];
  actions?: string[];
  submitted_at: string;
}

export interface AttendanceSession {
  id: number;
  submitter: number;
  submitter_email: string;
  work_date: string;
  check_in_at: string;
  check_out_at: string | null;
  worked_seconds: number | null;
}

export interface AttendanceToday {
  active: AttendanceSession | null;
  sessions: AttendanceSession[];
}

export interface AttendanceWeek {
  week_start: string;
  week_end: string;
  results: AttendanceSession[];
}

export interface ReportScopeEmployee {
  id: number;
  name: string;
  email: string;
  department: string;
  role: string;
}

export interface ReportScope {
  employees: ReportScopeEmployee[];
  departments: string[];
  request_types: { id: number; name: string }[];
  can_pick_employee: boolean;
}

export interface ReportResponse {
  results: Record<string, unknown>[];
  count: number;
  summary: Record<string, unknown>;
  meta: {
    report: string;
    filters: Record<string, unknown>;
    generated_at: string;
  };
}

export interface AppNotification {
  id: number;
  item_type: string;
  item_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  actor_email: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  comment: string;
  created_at: string;
}

export interface Dashboard {
  open_requests: number;
  current_timesheet_status: ItemStatus | null;
  unread_notifications: number;
  pending_reviews?: number;
  team_size?: number;
  active_employees?: number;
  requests_by_status?: Record<string, number>;
  timesheets_by_status?: Record<string, number>;
}

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ChatUser {
  id: number;
  email: string;
  role: Role;
  first_name: string;
  last_name: string;
  job_title: string;
}

export type CallOutcome =
  | "completed"
  | "missed"
  | "cancelled"
  | "declined"
  | "failed";

export interface CallEventInfo {
  call_id: string;
  mode: "audio" | "video";
  outcome: CallOutcome;
  duration_seconds: number;
}

export interface ChatMessage {
  id: number;
  conversation: number;
  sender: number;
  kind: "text" | "call";
  body: string;
  call: CallEventInfo | null;
  created_at: string;
}

export interface ChatConversation {
  id: number;
  kind: "direct";
  peer: ChatUser | null;
  last_message: ChatMessage | null;
  last_message_at: string | null;
  unread_count: number;
}
