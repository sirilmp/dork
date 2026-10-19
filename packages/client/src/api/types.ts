export type SystemRole = 'ADMIN' | 'MEMBER';
export type ProjectRole = 'ADMIN' | 'MEMBER' | 'VIEWER';
export type IssueType = 'EPIC' | 'STORY' | 'TASK' | 'BUG' | 'SUBTASK';
export type IssuePriority = 'LOWEST' | 'LOW' | 'MEDIUM' | 'HIGH' | 'HIGHEST';

// The one fixed concept behind a project's custom statuses: burndown/
// "is this done" logic checks category, never a status's name or id.
export type StatusCategory = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface WorkflowStatus {
  id: string;
  projectId: string;
  name: string;
  category: StatusCategory;
  order: number;
  color: string | null;
  isDefault: boolean;
  /** Advisory WIP limit for this column; null means no limit. */
  wipLimit: number | null;
}

export interface WorkflowTransition {
  id: string;
  projectId: string;
  fromStatusId: string | null;
  toStatusId: string;
}

export interface WorkflowResponse {
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
}

// Subset of WorkflowStatus embedded on an Issue (status is included server-side
// so the client never needs a second round-trip to render name/category/color).
export type IssueStatusRef = Pick<WorkflowStatus, 'id' | 'name' | 'category' | 'color' | 'order'>;

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role?: SystemRole;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: SystemRole;
  deactivatedAt: string | null;
  createdAt: string;
}

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface Invite {
  id: string;
  email: string;
  role: SystemRole;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  invitedBy: { id: string; name: string; email: string };
}

export interface InviteCreateResult {
  invite: Invite;
  inviteLink: string;
  emailSent: boolean;
  emailReason?: string;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { members: number };
}

export interface InvitePublicInfo {
  email: string;
  role: SystemRole;
  expiresAt: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string | null;
  leadId: string | null;
  lead: UserSummary | null;
  createdAt: string;
  _count?: { issues: number; members: number };
}

export interface ProjectMember {
  projectId: string;
  userId: string;
  role: ProjectRole;
  user: UserSummary;
}

export interface Label {
  id: string;
  projectId: string;
  name: string;
  color: string;
}

export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED';

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SprintWithIssues extends Sprint {
  issues: Issue[];
}

export interface BacklogResponse {
  sprints: SprintWithIssues[];
  backlog: Issue[];
}

export interface BurndownPoint {
  date: string;
  totalPoints: number;
  remainingPoints: number;
}

export interface BurndownResponse {
  sprintId: string;
  totalPoints: number;
  points: BurndownPoint[];
}

export type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'CHECKBOX';

export interface CustomFieldDefinition {
  id: string;
  projectId: string;
  name: string;
  fieldType: CustomFieldType;
  options: string[] | null;
  required: boolean;
  order: number;
}

// A project's custom field definition paired with this issue's value (or
// null when unset) — always the full set, from serializeIssue's join.
export interface IssueCustomField {
  id: string;
  name: string;
  fieldType: CustomFieldType;
  options: string[] | null;
  required: boolean;
  order: number;
  value: string | number | boolean | null;
}

export interface Attachment {
  id: string;
  issueId: string;
  uploadedById: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  createdAt: string;
  uploadedBy: { id: string; name: string; avatarUrl: string | null };
}

export interface Issue {
  id: string;
  key: string;
  projectId: string;
  number: number;
  type: IssueType;
  title: string;
  description: string | null;
  descriptionJson: Record<string, unknown> | null;
  statusId: string;
  status: IssueStatusRef;
  priority: IssuePriority;
  assigneeId: string | null;
  reporterId: string;
  parentId: string | null;
  storyPoints: number | null;
  dueDate: string | null;
  order: number;
  sprintId: string | null;
  backlogOrder: number;
  createdAt: string;
  updatedAt: string;
  assignee: UserSummary | null;
  reporter: UserSummary;
  labels?: Label[];
  // Minimal parent summary (present whenever parentId is set) used by the
  // board's epic swimlane grouping: an issue belongs to its parent's epic
  // only when that parent's own type is EPIC.
  parent?: { id: string; type: IssueType; title: string } | null;
  project: { id: string; key: string; name: string };
  customFields: IssueCustomField[];
  attachments: Attachment[];
  _count?: { comments: number; children: number };
}

export interface Comment {
  id: string;
  issueId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: UserSummary;
}

export interface ActivityLogEntry {
  id: string;
  issueId: string;
  actorId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  actor: UserSummary;
}

export interface IssueLink {
  id: string;
  issueId: string;
  linkedIssueId: string;
  type: 'BLOCKS' | 'RELATES_TO' | 'DUPLICATES';
}

export interface IssueDetail extends Issue {
  comments: Comment[];
  activity: ActivityLogEntry[];
  links: IssueLink[];
}

export interface BoardColumn {
  status: WorkflowStatus;
  issues: Issue[];
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface Branding {
  productName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string;
}

export interface SavedFilter {
  id: string;
  name: string;
  query: string;
  ownerId: string;
  projectId: string | null;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string; email: string; avatarUrl: string | null };
}

export interface QueryResult {
  issues: Issue[];
  orderBy: { field: string; dir: 'ASC' | 'DESC' } | null;
}

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromAddress: string;
  passwordSet: boolean;
}
