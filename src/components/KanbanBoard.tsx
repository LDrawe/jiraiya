import React, { useState, useEffect } from 'react';
import type { Ticket, TicketPriority, TicketStatus } from '../types/domain';
import {
  TICKET_COLUMNS,
  TICKET_PRIORITY_META,
  TICKET_TYPE_META,
  formatRelativeSyncTime,
} from '../utils/ticketPresentation';
import { computeViewportSafeDropdownPosition } from '../utils/topLayer';
import { Icon } from './Icon';

export type BoardViewMode = 'board' | 'list';

interface KanbanBoardProps {
  tickets: Ticket[];
  allTickets: Ticket[];
  viewMode: BoardViewMode;
  selectedTicketId: string | null;
  branchLabel: string;
  lastSyncedAt: number | null;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onSelectTicket: (ticket: Ticket) => void;
  onStatusChange: (ticket: Ticket, nextStatus: TicketStatus) => void;
  onPriorityChange: (ticket: Ticket, nextPriority: TicketPriority) => void;
  onAddTaskInColumn: (status: TicketStatus) => void;
}

type FloatingMenuState =
  | {
      kind: 'card';
      ticket: Ticket;
      top: number;
      left: number;
    }
  | {
      kind: 'column';
      status: TicketStatus;
      label: string;
      top: number;
      left: number;
    };

const PRIORITIES_ORDER: TicketPriority[] = ['critical', 'high', 'medium', 'low'];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tickets,
  allTickets,
  viewMode,
  selectedTicketId,
  branchLabel,
  lastSyncedAt,
  hasActiveFilters,
  onClearFilters,
  onSelectTicket,
  onStatusChange,
  onPriorityChange,
  onAddTaskInColumn,
}) => {
  const [draggingFilename, setDraggingFilename] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<TicketStatus | null>(null);
  const [menu, setMenu] = useState<FloatingMenuState | null>(null);

  useEffect(() => {
    if (!menu) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menu]);

  const doneTicketIds = new Set(
    allTickets.filter((t) => t.status === 'done').map((t) => t.id.toUpperCase())
  );

  function openCardMenu(e: React.MouseEvent<HTMLButtonElement>, ticket: Ticket): void {
    e.stopPropagation();
    const pos = computeViewportSafeDropdownPosition(e.currentTarget, 248, 300, true);
    setMenu({ kind: 'card', ticket, top: pos.top, left: pos.left });
  }

  function openColumnMenu(
    e: React.MouseEvent<HTMLButtonElement>,
    status: TicketStatus,
    label: string
  ): void {
    e.stopPropagation();
    const pos = computeViewportSafeDropdownPosition(e.currentTarget, 220, 110, true);
    setMenu({ kind: 'column', status, label, top: pos.top, left: pos.left });
  }

  function handleDropOnColumn(e: React.DragEvent<HTMLElement>, targetStatus: TicketStatus): void {
    e.preventDefault();
    setDropTargetStatus(null);
    const filename = e.dataTransfer.getData('text/plain') || draggingFilename;
    setDraggingFilename(null);
    if (!filename) return;
    const dragged = allTickets.find((t) => t.filename === filename);
    if (dragged && dragged.status !== targetStatus) {
      onStatusChange(dragged, targetStatus);
    }
  }

  return (
    <div className="kanban-board-frame">
      {viewMode === 'list' ? (
        tickets.length === 0 ? (
          <div className="onboarding-stage">
            <div className="onboarding-card">
              <div className="onboarding-emblem" aria-hidden="true">
                <Icon name="list-filter" size={20} />
              </div>
              <h2 className="onboarding-title">
                {hasActiveFilters
                  ? 'No tasks match the active filters'
                  : 'No tasks found in .jiraiya/tickets/'}
              </h2>
              <p className="onboarding-desc">
                {hasActiveFilters
                  ? 'Clear your search or filter selections to view all repository tasks.'
                  : 'Create a new task to record your first structured Markdown file.'}
              </p>
              {hasActiveFilters ? (
                <button type="button" className="btn-outline-pill" onClick={onClearFilters}>
                  Clear filters
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary-pill"
                  onClick={() => onAddTaskInColumn('ready')}
                >
                  <span className="btn-plus-icon">
                    <Icon name="plus-18" size={18} />
                  </span>
                  <span>New task</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="task-list-container" role="list" aria-label="Task list">
            {tickets.map((ticket) => {
              const typeMeta = TICKET_TYPE_META[ticket.type];
              const priorityMeta = TICKET_PRIORITY_META[ticket.priority];
              const colMeta =
                TICKET_COLUMNS.find((c) => c.status === ticket.status) ?? TICKET_COLUMNS[0];
              const totalCriteria = ticket.acceptanceCriteria.length;
              const completedCriteria = ticket.acceptanceCriteria.filter((c) => c.completed).length;
              const unresolvedDeps = ticket.dependencies.filter(
                (dep) => !doneTicketIds.has(dep.toUpperCase())
              );
              const isBlocked = unresolvedDeps.length > 0 && ticket.status !== 'done';
              const isSelected = ticket.id === selectedTicketId;

              return (
                <div
                  key={ticket.filename}
                  role="listitem"
                  className={`task-list-row ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => onSelectTicket(ticket)}
                >
                  <span className="drawer-ticket-id">{ticket.id}</span>

                  <div className="task-list-title-cell">
                    <button
                      type="button"
                      className="task-card-title-btn task-list-title"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTicket(ticket);
                      }}
                    >
                      {ticket.title}
                    </button>
                    {ticket.summary && <span className="task-list-sub">{ticket.summary}</span>}
                  </div>

                  <div>
                    <span className={`gruvbox-badge ${typeMeta.badgeClass}`}>
                      {typeMeta.label}
                    </span>
                    {isBlocked && (
                      <span
                        className="gruvbox-badge badge-crimson"
                        style={{ marginLeft: '4px' }}
                      >
                        Blocked
                      </span>
                    )}
                  </div>

                  <span className={`priority-flag-badge ${priorityMeta.colorClass}`}>
                    <Icon name="flag" size={12} />
                    <span>{priorityMeta.label}</span>
                  </span>

                  <span className="task-list-hide-md completion-label">
                    {colMeta.label}
                  </span>

                  <span className="task-list-hide-md task-card-checklist-label">
                    {totalCriteria > 0 ? (
                      <>
                        <Icon name="list-checks" size={13} />
                        <span>
                          {completedCriteria}/{totalCriteria}
                        </span>
                      </>
                    ) : (
                      <span className="task-card-id">—</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="task-columns-scroller" aria-label="Kanban board">
          {TICKET_COLUMNS.map((col) => {
            const columnTickets = tickets.filter((t) => t.status === col.status);
            const isDropTarget = dropTargetStatus === col.status;

            return (
              <section
                key={col.status}
                className={`task-column ${isDropTarget ? 'is-drop-target' : ''}`}
                aria-label={`${col.label} (${columnTickets.length})`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dropTargetStatus !== col.status) {
                    setDropTargetStatus(col.status);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setDropTargetStatus((prev) => (prev === col.status ? null : prev));
                  }
                }}
                onDrop={(e) => handleDropOnColumn(e, col.status)}
              >
                {/* Column/Header (#35:939) */}
                <header className="column-header-bar">
                  <span className={`column-status-icon ${col.iconClass}`}>
                    <Icon name={col.icon} size={18} />
                  </span>
                  <h2 className="column-header-title">{col.label}</h2>
                  <span className="column-count-badge">{columnTickets.length}</span>
                  <button
                    type="button"
                    className="icon-ellipsis-btn"
                    onClick={(e) => openColumnMenu(e, col.status, col.label)}
                    aria-label={`Column options for ${col.label}`}
                    title={`Column options for ${col.label}`}
                  >
                    <Icon name="ellipsis" size={16} />
                  </button>
                </header>

                {/* Cards List */}
                <div className="column-cards-list">
                  {columnTickets.length === 0 ? (
                    <div className="column-empty-placeholder">
                      {hasActiveFilters ? 'No results' : 'No tasks'}
                    </div>
                  ) : (
                    columnTickets.map((ticket) => {
                      const typeMeta = TICKET_TYPE_META[ticket.type];
                      const priorityMeta = TICKET_PRIORITY_META[ticket.priority];
                      const totalCriteria = ticket.acceptanceCriteria.length;
                      const completedCriteria = ticket.acceptanceCriteria.filter(
                        (c) => c.completed
                      ).length;
                      const progressPercent =
                        totalCriteria > 0 ? (completedCriteria / totalCriteria) * 100 : 0;

                      const unresolvedDeps = ticket.dependencies.filter(
                        (dep) => !doneTicketIds.has(dep.toUpperCase())
                      );
                      const isBlocked = unresolvedDeps.length > 0 && ticket.status !== 'done';
                      const isSelected = ticket.id === selectedTicketId;
                      const isDone = ticket.status === 'done';
                      const isDragging = draggingFilename === ticket.filename;

                      return (
                        <article
                          key={ticket.filename}
                          className={[
                            'task-card',
                            isSelected ? 'is-selected' : '',
                            isDone ? 'is-done' : '',
                            isDragging ? 'is-dragging' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', ticket.filename);
                            e.dataTransfer.effectAllowed = 'move';
                            setDraggingFilename(ticket.filename);
                          }}
                          onDragEnd={() => {
                            setDraggingFilename(null);
                            setDropTargetStatus(null);
                          }}
                          onClick={() => onSelectTicket(ticket)}
                        >
                          {/* Task labels (#6:421) */}
                          <div className="task-card-labels-row">
                            <div className="task-card-categories">
                              <span className={`gruvbox-badge ${typeMeta.badgeClass}`}>
                                {typeMeta.label}
                              </span>
                              {isBlocked && (
                                <span className="gruvbox-badge badge-crimson">Blocked</span>
                              )}
                              <span className={`priority-flag-badge ${priorityMeta.colorClass}`}>
                                <Icon name="flag" size={12} />
                                <span>{priorityMeta.label}</span>
                              </span>
                            </div>

                            <button
                              type="button"
                              className="icon-ellipsis-btn"
                              onClick={(e) => openCardMenu(e, ticket)}
                              aria-label={`Quick actions for ${ticket.id}`}
                              title="Change status or priority"
                            >
                              <Icon name="ellipsis" size={16} />
                            </button>
                          </div>

                          {/* Task details (#6:425) */}
                          <div className="task-card-details">
                            <h3 className="task-card-title">
                              <button
                                type="button"
                                className="task-card-title-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectTicket(ticket);
                                }}
                              >
                                {ticket.title}
                              </button>
                            </h3>
                            {ticket.summary && (
                              <p className="task-card-summary">{ticket.summary}</p>
                            )}
                          </div>

                          {/* Checklist progress (#6:430) */}
                          {totalCriteria > 0 && (
                            <div className="task-card-checklist">
                              <div className="task-card-checklist-row">
                                <span className="task-card-checklist-label">
                                  <Icon name="list-checks" size={13} />
                                  <span>Checklist</span>
                                </span>
                                <span className="task-card-checklist-ratio">
                                  {completedCriteria}/{totalCriteria}
                                </span>
                              </div>
                              <div
                                className="task-card-progress-track"
                                role="progressbar"
                                aria-valuenow={completedCriteria}
                                aria-valuemin={0}
                                aria-valuemax={totalCriteria}
                                aria-label={`Criteria progress: ${completedCriteria} of ${totalCriteria}`}
                              >
                                <div
                                  className="task-card-progress-fill"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Task metadata (#6:437) */}
                          <footer className="task-card-metadata">
                            <div className="task-card-activity">
                              <span className="task-card-id">{ticket.id}</span>

                              {ticket.decisions.length > 0 && (
                                <span
                                  className="task-meta-stat"
                                  title={`Architecture decisions: ${ticket.decisions.join(', ')}`}
                                >
                                  <Icon name="paperclip" size={12} />
                                  <span>{ticket.decisions.length}</span>
                                </span>
                              )}

                              {ticket.concepts.length > 0 && (
                                <span
                                  className="task-meta-stat"
                                  title={`Technical concepts: ${ticket.concepts.join(', ')}`}
                                >
                                  <Icon name="book-open" size={12} />
                                  <span>{ticket.concepts.length}</span>
                                </span>
                              )}
                            </div>

                            {isBlocked ? (
                              <span
                                className="task-dep-hint"
                                title={`Waiting for: ${unresolvedDeps.join(', ')}`}
                              >
                                Needs {unresolvedDeps[0]}
                                {unresolvedDeps.length > 1 ? ` +${unresolvedDeps.length - 1}` : ''}
                              </span>
                            ) : ticket.tags.length > 0 ? (
                              <span className="task-card-id">#{ticket.tags[0]}</span>
                            ) : null}
                          </footer>
                        </article>
                      );
                    })
                  )}
                </div>

                {/* Button/Add task (#35:226) */}
                <button
                  type="button"
                  className="column-add-task-btn"
                  onClick={() => onAddTaskInColumn(col.status)}
                >
                  <Icon name="plus" size={14} />
                  <span>Add task</span>
                </button>
              </section>
            );
          })}
        </div>
      )}

      {/* Board footer (#6:769) */}
      <footer className="board-footer-bar">
        <div className="board-footer-repo">
          <Icon name="git-branch-12" size={12} />
          <span>
            {branchLabel} · {formatRelativeSyncTime(lastSyncedAt)}
          </span>
        </div>
        <span className="board-footer-motto">
          Small steps. Thoughtful code. Good things ahead.
        </span>
      </footer>

      {/* Floating Quick-Actions Dropdown (Card or Column) */}
      {menu && (
        <>
          <div
            className="floating-dropdown-backdrop"
            onClick={() => setMenu(null)}
            aria-hidden="true"
          />
          <div
            className="floating-dropdown-panel"
            style={{
              top: `${menu.top}px`,
              left: `${menu.left}px`,
              width: menu.kind === 'column' ? '220px' : '248px',
            }}
            role="menu"
            aria-label={
              menu.kind === 'card'
                ? `Actions for ${menu.ticket.id}`
                : `Column options for ${menu.label}`
            }
          >
            {menu.kind === 'column' ? (
              <button
                type="button"
                className="dropdown-option-btn"
                role="menuitem"
                onClick={() => {
                  const targetStatus = menu.status;
                  setMenu(null);
                  onAddTaskInColumn(targetStatus);
                }}
              >
                <span>New task in {menu.label}</span>
                <Icon name="plus" size={14} />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="dropdown-option-btn"
                  role="menuitem"
                  onClick={() => {
                    const target = menu.ticket;
                    setMenu(null);
                    onSelectTicket(target);
                  }}
                >
                  <span>Open details & edit</span>
                  <Icon name="arrow-up-right" size={13} />
                </button>

                <div className="dropdown-divider" />

                <div className="dropdown-section">
                  <span className="dropdown-section-title">Move to status</span>
                  {TICKET_COLUMNS.map((col) => {
                    const active = menu.ticket.status === col.status;
                    return (
                      <button
                        key={col.status}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        className={`dropdown-option-btn ${active ? 'is-selected' : ''}`}
                        onClick={() => {
                          const target = menu.ticket;
                          setMenu(null);
                          if (target.status !== col.status) {
                            onStatusChange(target, col.status);
                          }
                        }}
                      >
                        <span>{col.label}</span>
                        {active && <Icon name="check" size={13} />}
                      </button>
                    );
                  })}
                </div>

                <div className="dropdown-divider" />

                <div className="dropdown-section">
                  <span className="dropdown-section-title">Priority</span>
                  <div className="dropdown-chip-grid">
                    {PRIORITIES_ORDER.map((prio) => {
                      const prioMeta = TICKET_PRIORITY_META[prio];
                      const active = menu.ticket.priority === prio;
                      return (
                        <button
                          key={prio}
                          type="button"
                          role="menuitemradio"
                          aria-checked={active}
                          className={`dropdown-chip-btn ${active ? 'is-selected' : ''}`}
                          onClick={() => {
                            const target = menu.ticket;
                            setMenu(null);
                            if (target.priority !== prio) {
                              onPriorityChange(target, prio);
                            }
                          }}
                        >
                          <Icon name="flag" size={11} />
                          <span>{prioMeta.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
