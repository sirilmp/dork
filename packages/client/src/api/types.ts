export type SystemRole = 'ADMIN' | 'MEMBER';
export type ProjectRole = 'ADMIN' | 'MEMBER' | 'VIEWER';
export type IssueType = 'EPIC' | 'STORY' | 'TASK' | 'BUG' | 'SUBTASK';
export type IssueStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type IssuePriority = 'LOWEST' | 'LOW' | 'MEDIUM' | 'HIGH' | 'HIGHEST';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role?: SystemRole;
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

export interface Issue {
  id: string;
  key: string;
  projectId: string;
  number: number;
  type: IssueType;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId: string | null;
  reporterId: string;
  parentId: string | null;
  storyPoints: number | null;
  dueDate: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  assignee: UserSummary | null;
  reporter: UserSummary;
  labels?: Label[];
  project: { id: string; key: string; name: string };
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
  status: IssueStatus;
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

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromAddress: string;
  passwordSet: boolean;
}
