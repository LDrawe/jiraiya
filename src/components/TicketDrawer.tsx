import React, { useEffect, useId, useRef, useState } from 'react';
import type {
  Ticket,
  TicketEditablePatch,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '../types/domain';
import { extractBodyFromRaw } from '../core/parser';
import {
  TICKET_COLUMNS,
  TICKET_PRIORITY_META,
  TICKET_TYPE_META,
} from '../utils/ticketPresentation';
import { attachDialogBackdropFallback, closeDialogSmoothly } from '../utils/topLayer';
import { Icon } from './Icon';
import { MarkdownView } from './MarkdownView';

interface TicketDrawerProps {
  ticket: Ticket | null;
  allTickets: Ticket[];
  onClose: () => void;
  onStatusChange: (ticket: Ticket, nextStatus: TicketStatus) => Promise<void>;
  onPriorityChange: (ticket: Ticket, nextPriority: TicketPriority) => Promise<void>;
  onUpdateFields: (ticket: Ticket, patch: TicketEditablePatch) => Promise<void>;
  onToggleCriterion: (ticket: Ticket, criterionIndex: number) => Promise<void>;
  onSelectTicket: (ticket: Ticket) => void;
  onNavigateDecision: (decisionId: string) => void;
}

const PRIORITY_OPTIONS: TicketPriority[] = ['critical', 'high', 'medium', 'low'];
const TYPE_OPTIONS: TicketType[] = ['lab', 'story', 'task', 'epic', 'bug'];

export const TicketDrawer: React.FC<TicketDrawerProps> = ({
  ticket,
  allTickets,
  onClose,
  onStatusChange,
  onPriorityChange,
  onUpdateFields,
  onToggleCriterion,
  onSelectTicket,
  onNavigateDecision,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastTicketRef = useRef<Ticket | null>(null);
  const headingId = useId();

  if (ticket) {
    lastTicketRef.current = ticket;
  }
  const activeTicket = ticket ?? lastTicketRef.current;

  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');

  // Reset local editor draft whenever the user switches to another ticket
  const currentFilename = ticket?.filename ?? null;
  const prevFilenameRef = useRef<string | null>(null);
  if (currentFilename !== prevFilenameRef.current) {
    prevFilenameRef.current = currentFilename;
    if (isEditing) setIsEditing(false);
    if (isAddingTag) setIsAddingTag(false);
    if (newTagText) setNewTagText('');
  }

  async function requestAnimatedClose(): Promise<void> {
    const dialog = dialogRef.current;
    if (!dialog) {
      onClose();
      return;
    }
    await closeDialogSmoothly(dialog);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (ticket) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      void closeDialogSmoothly(dialog);
    }
  }, [ticket]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    return attachDialogBackdropFallback(dialog, () => {
      void requestAnimatedClose();
    });
  });

  function startEditing(): void {
    if (!activeTicket) return;
    setDraftTitle(activeTicket.title);
    setDraftBody(extractBodyFromRaw(activeTicket.rawContent));
    setIsEditing(true);
  }

  async function handleSaveEdits(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!activeTicket || !draftTitle.trim()) return;
    setIsSaving(true);
    try {
      await onUpdateFields(activeTicket, {
        title: draftTitle.trim(),
        body: draftBody,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddTag(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!activeTicket) return;
    const cleaned = newTagText.trim().toLowerCase().replace(/^#+/, '');
    if (!cleaned) {
      setIsAddingTag(false);
      return;
    }
    if (!activeTicket.tags.includes(cleaned)) {
      await onUpdateFields(activeTicket, {
        tags: [...activeTicket.tags, cleaned],
      });
    }
    setNewTagText('');
    setIsAddingTag(false);
  }

  async function handleRemoveTag(tagToRemove: string): Promise<void> {
    if (!activeTicket) return;
    await onUpdateFields(activeTicket, {
      tags: activeTicket.tags.filter((t) => t !== tagToRemove),
    });
  }

  const completedCount = activeTicket
    ? activeTicket.acceptanceCriteria.filter((c) => c.completed).length
    : 0;
  const totalCount = activeTicket ? activeTicket.acceptanceCriteria.length : 0;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const doneTicketIds = new Set(
    allTickets.filter((t) => t.status === 'done').map((t) => t.id.toUpperCase())
  );
  const unresolvedDeps = activeTicket
    ? activeTicket.dependencies.filter((dep) => !doneTicketIds.has(dep.toUpperCase()))
    : [];
  const isBlocked = Boolean(
    activeTicket && unresolvedDeps.length > 0 && activeTicket.status !== 'done'
  );

  return (
    <dialog
      ref={dialogRef}
      className="ticket-drawer-dialog"
      aria-labelledby={headingId}
      onCancel={(e) => {
        e.preventDefault();
        void requestAnimatedClose();
      }}
      onClose={() => {
        setIsEditing(false);
        setIsAddingTag(false);
        if (ticket) {
          onClose();
        }
      }}
      {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
    >
      {activeTicket && (
        <>
          {/* Header */}
          <header className="drawer-header">
            <div className="drawer-header-main">
              <div className="drawer-meta-badges">
                <span className="drawer-ticket-id">{activeTicket.id}</span>
                <span
                  className={`gruvbox-badge ${TICKET_TYPE_META[activeTicket.type].badgeClass}`}
                >
                  {TICKET_TYPE_META[activeTicket.type].label}
                </span>
                {isBlocked && <span className="gruvbox-badge badge-crimson">Blocked</span>}
                <span
                  className={`priority-flag-badge ${TICKET_PRIORITY_META[activeTicket.priority].colorClass}`}
                >
                  <Icon name="flag" size={12} />
                  <span>{TICKET_PRIORITY_META[activeTicket.priority].label}</span>
                </span>
              </div>

              <h2 id={headingId} className="drawer-title">
                {activeTicket.title}
              </h2>
            </div>

            <div className="drawer-header-actions">
              <button
                type="button"
                className={`drawer-icon-btn ${isEditing ? 'is-active' : ''}`}
                onClick={() => {
                  if (isEditing) {
                    setIsEditing(false);
                  } else {
                    startEditing();
                  }
                }}
                title={isEditing ? 'Exit edit mode' : 'Edit title and Markdown'}
                aria-label={isEditing ? 'Cancel editing' : 'Edit ticket'}
                aria-pressed={isEditing}
              >
                <Icon name="edit" size={15} />
              </button>

              <button
                type="button"
                className="drawer-icon-btn"
                onClick={() => void requestAnimatedClose()}
                aria-label="Close ticket drawer"
                title="Close (Esc)"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          </header>

          {/* Barra de Propriedades Persistidas Diretamente em .jiraiya/tickets/ */}
          <div className="drawer-properties-bar">
            <label className="property-field-card">
              <span className="property-field-label">Status</span>
              <select
                className="property-field-select"
                value={activeTicket.status}
                onChange={(e) =>
                  void onStatusChange(activeTicket, e.target.value as TicketStatus)
                }
              >
                {TICKET_COLUMNS.map((col) => (
                  <option key={col.status} value={col.status}>
                    {col.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="property-field-card">
              <span className="property-field-label">Priority</span>
              <select
                className="property-field-select"
                value={activeTicket.priority}
                onChange={(e) =>
                  void onPriorityChange(activeTicket, e.target.value as TicketPriority)
                }
              >
                {PRIORITY_OPTIONS.map((prio) => (
                  <option key={prio} value={prio}>
                    {TICKET_PRIORITY_META[prio].label}
                  </option>
                ))}
              </select>
            </label>

            <label className="property-field-card">
              <span className="property-field-label">Type</span>
              <select
                className="property-field-select"
                value={activeTicket.type}
                onChange={(e) =>
                  void onUpdateFields(activeTicket, { type: e.target.value as TicketType })
                }
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {TICKET_TYPE_META[t].label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Corpo Rolável */}
          {isEditing ? (
            <form
              id="ticket-markdown-edit-form"
              className="drawer-scroll-body"
              onSubmit={(e) => void handleSaveEdits(e)}
            >
              <div className="form-field-group">
                <label className="form-label" htmlFor="edit-ticket-title">
                  Task title
                </label>
                <input
                  id="edit-ticket-title"
                  type="text"
                  className="form-input"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-field-group" style={{ flex: 1 }}>
                <label className="form-label" htmlFor="edit-ticket-markdown">
                  Markdown content (.jiraiya/tickets/{activeTicket.filename})
                </label>
                <textarea
                  id="edit-ticket-markdown"
                  className="form-textarea"
                  style={{ flex: 1, minHeight: '300px' }}
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                />
              </div>
            </form>
          ) : (
            <div className="drawer-scroll-body">
              {/* Tags */}
              <section className="drawer-section" aria-label="Tags">
                <div className="tags-editor-row">
                  {activeTicket.tags.map((tag) => (
                    <span key={tag} className="tag-chip">
                      <span>#{tag}</span>
                      <button
                        type="button"
                        className="tag-remove-btn"
                        onClick={() => void handleRemoveTag(tag)}
                        aria-label={`Remove tag ${tag}`}
                        title={`Remove #${tag}`}
                      >
                        <Icon name="close" size={12} />
                      </button>
                    </span>
                  ))}

                  {isAddingTag ? (
                    <form className="inline-tag-form" onSubmit={(e) => void handleAddTag(e)}>
                      <input
                        type="text"
                        className="inline-tag-input"
                        placeholder="new-tag"
                        value={newTagText}
                        onChange={(e) => setNewTagText(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.stopPropagation();
                            setIsAddingTag(false);
                            setNewTagText('');
                          }
                        }}
                      />
                      <button
                        type="submit"
                        className="add-tag-trigger"
                        aria-label="Confirm tag"
                      >
                        <Icon name="check" size={12} />
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="add-tag-trigger"
                      onClick={() => setIsAddingTag(true)}
                    >
                      <Icon name="plus" size={12} />
                      <span>Add tag</span>
                    </button>
                  )}
                </div>
              </section>

              {/* Acceptance Criteria */}
              {totalCount > 0 && (
                <section className="drawer-section" aria-label="Acceptance criteria checklist">
                  <div className="drawer-checklist-card">
                    <div className="drawer-section-header">
                      <h3 className="drawer-section-heading">
                        <Icon name="list-checks" size={14} />
                        <span>Checklist</span>
                      </h3>
                      <span className="task-card-checklist-ratio">
                        {completedCount}/{totalCount} completed
                      </span>
                    </div>

                    <div
                      className="task-card-progress-track"
                      role="progressbar"
                      aria-valuenow={completedCount}
                      aria-valuemin={0}
                      aria-valuemax={totalCount}
                    >
                      <div
                        className="task-card-progress-fill"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    <ul className="criteria-list">
                      {activeTicket.acceptanceCriteria.map((item) => (
                        <li key={item.index}>
                          <label
                            className={`criteria-row-label ${item.completed ? 'is-completed' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={() => void onToggleCriterion(activeTicket, item.index)}
                            />
                            <span>{item.text}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {/* Technical Concepts */}
              {activeTicket.concepts.length > 0 && (
                <section className="drawer-section" aria-label="Technical concepts">
                  <div className="concepts-panel">
                    <h3 className="drawer-section-heading">
                      <Icon name="book-open" size={14} />
                      <span>Engineering Concepts</span>
                    </h3>
                    <div className="concepts-pills">
                      {activeTicket.concepts.map((concept) => (
                        <span key={concept} className="gruvbox-badge badge-aqua">
                          {concept}
                        </span>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* Dependencies and Decisions */}
              {(activeTicket.dependencies.length > 0 || activeTicket.decisions.length > 0) && (
                <section className="drawer-section" aria-label="Relationships and ADRs">
                  <h3 className="drawer-section-heading">Relationships</h3>
                  <div className="relation-pills-list">
                    {activeTicket.dependencies.map((depId) => {
                      const depTicket = allTickets.find(
                        (t) => t.id.toUpperCase() === depId.toUpperCase()
                      );
                      const depDone = doneTicketIds.has(depId.toUpperCase());
                      return depTicket ? (
                        <button
                          key={depId}
                          type="button"
                          className="relation-pill-btn"
                          onClick={() => onSelectTicket(depTicket)}
                          title={`Open dependency ${depTicket.id}: ${depTicket.title}`}
                        >
                          <Icon
                            name={depDone ? 'circle-check' : 'lock'}
                            size={13}
                          />
                          <span>Depends on {depTicket.id}</span>
                          <Icon name="arrow-up-right" size={12} />
                        </button>
                      ) : (
                        <span key={depId} className="tag-chip">
                          <Icon name="lock" size={12} />
                          <span>Depends on {depId}</span>
                        </span>
                      );
                    })}

                    {activeTicket.decisions.map((adrId) => (
                      <button
                        key={adrId}
                        type="button"
                        className="relation-pill-btn"
                        onClick={() => {
                          void requestAnimatedClose().then(() => {
                            onNavigateDecision(adrId);
                          });
                        }}
                        title={`View architectural decision ${adrId}`}
                      >
                        <Icon name="paperclip" size={13} />
                        <span>{adrId} · Architecture Decision</span>
                        <Icon name="arrow-up-right" size={12} />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Markdown Specification */}
              <section className="drawer-section" aria-label="Markdown specification">
                <div className="drawer-section-header">
                  <h3 className="drawer-section-heading">Specification</h3>
                </div>
                {activeTicket.ast.children.length > 0 ? (
                  <MarkdownView ast={activeTicket.ast} />
                ) : (
                  <div className="column-empty-placeholder">
                    This ticket has no additional Markdown body. Click{' '}
                    <strong>Edit Markdown</strong> to document context or criteria.
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Footer */}
          <footer className="drawer-footer">
            <span className="drawer-filepath" title={`.jiraiya/tickets/${activeTicket.filename}`}>
              .jiraiya/tickets/{activeTicket.filename}
            </span>

            <div className="drawer-footer-btns">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    className="btn-outline-pill"
                    onClick={() => setIsEditing(false)}
                    disabled={isSaving}
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    form="ticket-markdown-edit-form"
                    className="btn-primary-pill"
                    disabled={isSaving || !draftTitle.trim()}
                  >
                    {isSaving ? 'Saving...' : 'Save to file'}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn-outline-pill" onClick={startEditing}>
                    <Icon name="edit" size={14} />
                    <span>Edit Markdown</span>
                  </button>
                  <button
                    type="button"
                    className="btn-primary-pill"
                    onClick={() => void requestAnimatedClose()}
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </footer>
        </>
      )}
    </dialog>
  );
};
