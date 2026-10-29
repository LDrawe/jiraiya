import type { Root } from 'mdast';

export type TicketStatus = 'backlog' | 'ready' | 'in_progress' | 'review' | 'done';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketType = 'epic' | 'story' | 'task' | 'bug' | 'lab';

export interface AcceptanceCriterion {
  index: number;
  text: string;
  completed: boolean;
}

export interface Ticket {
  filename: string;
  lastModified: number;
  rawContent: string;
  id: string;
  title: string;
  summary: string;
  type: TicketType;
  status: TicketStatus;
  priority: TicketPriority;
  tags: string[];
  concepts: string[];
  dependencies: string[];
  decisions: string[];
  acceptanceCriteria: AcceptanceCriterion[];
  ast: Root;
}

export interface TicketEditablePatch {
  title?: string;
  type?: TicketType;
  status?: TicketStatus;
  priority?: TicketPriority;
  tags?: string[];
  body?: string;
}

export interface NewTicketInput {
  id: string;
  title: string;
  type: TicketType;
  status: TicketStatus;
  priority: TicketPriority;
  tags: string[];
  summary: string;
  criteria: string[];
}

export interface ArchitectureDecision {
  filename: string;
  lastModified: number;
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  date: string;
  ast: Root;
}

export interface ProjectConfig {
  name: string;
  description?: string;
  createdAt: string;
}

export interface RegisteredProject {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  permissionState: PermissionState;
  ticketCount?: number;
  doneCount?: number;
}

export interface LoadedWorkspace {
  config: ProjectConfig;
  tickets: Ticket[];
  decisions: ArchitectureDecision[];
  gitBranch?: string;
}
