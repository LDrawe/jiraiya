import React, { useEffect, useId, useRef, useState } from 'react';
import type {
  NewTicketInput,
  Ticket,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '../types/domain';
import { suggestNextTicketId } from '../core/parser';
import {
  TICKET_COLUMNS,
  TICKET_PRIORITY_META,
  TICKET_TYPE_META,
} from '../utils/ticketPresentation';
import { attachDialogBackdropFallback, closeDialogSmoothly } from '../utils/topLayer';
import { Icon } from './Icon';

interface NewTicketDialogProps {
  isOpen: boolean;
  initialStatus: TicketStatus;
  existingTickets: Ticket[];
  onClose: () => void;
  onCreateTicket: (input: NewTicketInput) => Promise<void>;
}

const PRIORITY_OPTIONS: TicketPriority[] = ['critical', 'high', 'medium', 'low'];
const TYPE_OPTIONS: TicketType[] = ['task', 'lab', 'story', 'bug', 'epic'];

export const NewTicketDialog: React.FC<NewTicketDialogProps> = ({
  isOpen,
  initialStatus,
  existingTickets,
  onClose,
  onCreateTicket,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  const [ticketId, setTicketId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TicketType>('task');
  const [status, setStatus] = useState<TicketStatus>(initialStatus);
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [tagsRaw, setTagsRaw] = useState('');
  const [summary, setSummary] = useState('');
  const [criteriaRaw, setCriteriaRaw] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Re-initialize form defaults whenever the modal opens
  const wasOpenRef = useRef(false);
  if (isOpen && !wasOpenRef.current) {
    wasOpenRef.current = true;
    setTicketId(suggestNextTicketId(existingTickets));
    setTitle('');
    setType('task');
    setStatus(initialStatus);
    setPriority('medium');
    setTagsRaw('');
    setSummary('');
    setCriteriaRaw('');
    setLocalError(null);
  } else if (!isOpen && wasOpenRef.current) {
    wasOpenRef.current = false;
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

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      void closeDialogSmoothly(dialog);
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    return attachDialogBackdropFallback(dialog, () => {
      void requestAnimatedClose();
    });
  });

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!ticketId.trim() || !title.trim()) {
      setLocalError('Please provide a ticket ID and title.');
      return;
    }

    setLocalError(null);
    setIsSubmitting(true);
    try {
      const tags = tagsRaw
        .split(',')
        .map((t) => t.trim().toLowerCase().replace(/^#+/, ''))
        .filter(Boolean);
      const criteria = criteriaRaw
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*[-*+]\s*(\[[ xX]\])?\s*/, '').trim())
        .filter(Boolean);

      await onCreateTicket({
        id: ticketId.trim().toUpperCase(),
        title: title.trim(),
        type,
        status,
        priority,
        tags,
        summary: summary.trim(),
        criteria,
      });

      await requestAnimatedClose();
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Unable to create ticket file.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal-card-dialog"
      aria-labelledby={headingId}
      onCancel={(e) => {
        e.preventDefault();
        void requestAnimatedClose();
      }}
      onClose={() => {
        if (isOpen) {
          onClose();
        }
      }}
      {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
    >
      <header className="drawer-header">
        <div className="drawer-header-main">
          <span className="sidebar-section-label">New file in .jiraiya/tickets/</span>
          <h2 id={headingId} className="drawer-title">
            New task
          </h2>
        </div>

        <button
          type="button"
          className="drawer-icon-btn"
          onClick={() => void requestAnimatedClose()}
          aria-label="Close new task dialog"
        >
          <Icon name="close" size={16} />
        </button>
      </header>

      <form id="new-ticket-form" className="drawer-scroll-body" onSubmit={(e) => void handleSubmit(e)}>
        {localError && (
          <div className="workspace-banner" style={{ margin: 0 }}>
            <span className="workspace-banner-icon">
              <Icon name="alert" size={16} />
            </span>
            <span className="workspace-banner-text">{localError}</span>
          </div>
        )}

        <div className="form-grid-3">
          <div className="form-field-group">
            <label className="form-label" htmlFor="new-ticket-id">
              ID
            </label>
            <input
              id="new-ticket-id"
              type="text"
              className="form-input"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="JIR-103"
              required
            />
          </div>

          <div className="form-field-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label" htmlFor="new-ticket-title">
              Title
            </label>
            <input
              id="new-ticket-title"
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement token bucket rate limiter"
              autoFocus
              required
            />
          </div>
        </div>

        <div className="form-grid-3">
          <div className="form-field-group">
            <label className="form-label" htmlFor="new-ticket-status">
              Status
            </label>
            <select
              id="new-ticket-status"
              className="form-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as TicketStatus)}
            >
              {TICKET_COLUMNS.map((col) => (
                <option key={col.status} value={col.status}>
                  {col.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field-group">
            <label className="form-label" htmlFor="new-ticket-priority">
              Priority
            </label>
            <select
              id="new-ticket-priority"
              className="form-select"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
            >
              {PRIORITY_OPTIONS.map((prio) => (
                <option key={prio} value={prio}>
                  {TICKET_PRIORITY_META[prio].label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field-group">
            <label className="form-label" htmlFor="new-ticket-type">
              Type
            </label>
            <select
              id="new-ticket-type"
              className="form-select"
              value={type}
              onChange={(e) => setType(e.target.value as TicketType)}
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {TICKET_TYPE_META[t].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field-group">
          <label className="form-label" htmlFor="new-ticket-tags">
            Tags (comma-separated)
          </label>
          <input
            id="new-ticket-tags"
            type="text"
            className="form-input"
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="concurrency, performance, auth"
          />
        </div>

        <div className="form-field-group">
          <label className="form-label" htmlFor="new-ticket-summary">
            Context & goals
          </label>
          <textarea
            id="new-ticket-summary"
            className="form-textarea"
            style={{ minHeight: '92px' }}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Describe technical context, goals or requirements..."
          />
        </div>

        <div className="form-field-group">
          <label className="form-label" htmlFor="new-ticket-criteria">
            Acceptance criteria checklist (one per line)
          </label>
          <textarea
            id="new-ticket-criteria"
            className="form-textarea"
            style={{ minHeight: '96px' }}
            value={criteriaRaw}
            onChange={(e) => setCriteriaRaw(e.target.value)}
            placeholder={'Ensure thread-safe concurrent access\nCover edge cases with unit tests'}
          />
        </div>
      </form>

      <footer className="drawer-footer">
        <span className="drawer-filepath">
          .jiraiya/tickets/{(ticketId.trim().toUpperCase() || 'TASK')}.md
        </span>

        <div className="drawer-footer-btns">
          <button
            type="button"
            className="btn-outline-pill"
            onClick={() => void requestAnimatedClose()}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="new-ticket-form"
            className="btn-primary-pill"
            disabled={isSubmitting || !title.trim()}
          >
            <span className="btn-plus-icon">
              <Icon name="plus-18" size={18} />
            </span>
            <span>{isSubmitting ? 'Creating...' : 'Create task'}</span>
          </button>
        </div>
      </footer>
    </dialog>
  );
};
