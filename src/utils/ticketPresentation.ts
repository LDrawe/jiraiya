import type {
  ArchitectureDecision,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '../types/domain';
import type { IconName } from '../components/Icon';

export interface ColumnDefinition {
  status: TicketStatus;
  label: string;
  icon: IconName;
  iconClass: string;
}

export const TICKET_COLUMNS: ColumnDefinition[] = [
  {
    status: 'backlog',
    label: 'Backlog',
    icon: 'circle-dashed',
    iconClass: 'status-icon-backlog',
  },
  {
    status: 'ready',
    label: 'Ready',
    icon: 'circle-dashed',
    iconClass: 'status-icon-ready',
  },
  {
    status: 'in_progress',
    label: 'In progress',
    icon: 'circle-dot',
    iconClass: 'status-icon-in_progress',
  },
  {
    status: 'review',
    label: 'In review',
    icon: 'scan-eye',
    iconClass: 'status-icon-review',
  },
  {
    status: 'done',
    label: 'Done',
    icon: 'circle-check',
    iconClass: 'status-icon-done',
  },
];

export const TICKET_TYPE_META: Record<
  TicketType,
  { label: string; badgeClass: string }
> = {
  lab: { label: 'Lab', badgeClass: 'badge-green' },
  story: { label: 'Story', badgeClass: 'badge-aqua' },
  task: { label: 'Task', badgeClass: 'badge-yellow' },
  epic: { label: 'Epic', badgeClass: 'badge-orange' },
  bug: { label: 'Bug', badgeClass: 'badge-crimson' },
};

export const TICKET_PRIORITY_META: Record<
  TicketPriority,
  { label: string; colorClass: string; weight: number }
> = {
  critical: { label: 'Critical', colorClass: 'priority-critical', weight: 4 },
  high: { label: 'High', colorClass: 'priority-high', weight: 3 },
  medium: { label: 'Medium', colorClass: 'priority-medium', weight: 2 },
  low: { label: 'Low', colorClass: 'priority-low', weight: 1 },
};

export const DECISION_STATUS_META: Record<
  ArchitectureDecision['status'],
  { label: string; badgeClass: string }
> = {
  accepted: { label: 'Accepted', badgeClass: 'badge-green' },
  proposed: { label: 'Proposed', badgeClass: 'badge-yellow' },
  deprecated: { label: 'Deprecated', badgeClass: 'badge-orange' },
  superseded: { label: 'Superseded', badgeClass: 'badge-crimson' },
};

export function formatRelativeSyncTime(timestampMs: number | null): string {
  if (!timestampMs) return 'Local .jiraiya';
  const diffSec = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (diffSec < 45) return 'Synced just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Synced ${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Synced ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `Synced ${diffDays}d ago`;
}
