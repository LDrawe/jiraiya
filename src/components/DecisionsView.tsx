import React from 'react';
import type { ArchitectureDecision } from '../types/domain';
import { DECISION_STATUS_META } from '../utils/ticketPresentation';
import { Icon } from './Icon';
import { MarkdownView } from './MarkdownView';

interface DecisionsViewProps {
  decisions: ArchitectureDecision[];
  selectedDecisionId: string | null;
  onSelectDecision: (id: string) => void;
  onBackToBoard: () => void;
}

export const DecisionsView: React.FC<DecisionsViewProps> = ({
  decisions,
  selectedDecisionId,
  onSelectDecision,
  onBackToBoard,
}) => {
  if (decisions.length === 0) {
    return (
      <div className="onboarding-stage">
        <div className="onboarding-card">
          <div className="onboarding-emblem" aria-hidden="true">
            <Icon name="book-open" size={22} />
          </div>
          <h2 className="onboarding-title">No architectural decisions found</h2>
          <p className="onboarding-desc">
            Add Markdown files inside <code>.jiraiya/decisions/</code> to document ADRs,
            trade-offs, evaluated alternatives, and technical consequences.
          </p>
          <button type="button" className="btn-outline-pill" onClick={onBackToBoard}>
            <Icon name="columns-3" size={16} />
            <span>Back to board</span>
          </button>
        </div>
      </div>
    );
  }

  const activeDecision =
    decisions.find((d) => d.id.toUpperCase() === selectedDecisionId?.toUpperCase()) ??
    decisions[0];
  const activeBadge = DECISION_STATUS_META[activeDecision.status];

  return (
    <div className="decisions-stage">
      <aside className="decisions-sidebar-panel" aria-label="Architectural decisions list">
        <div className="sidebar-section-heading">
          <span className="sidebar-section-label">ADRs ({decisions.length})</span>
        </div>

        <ul className="decisions-list-ul">
          {decisions.map((adr) => {
            const isActive = adr.id === activeDecision.id;
            const statusMeta = DECISION_STATUS_META[adr.status];
            return (
              <li key={adr.filename}>
                <button
                  type="button"
                  className={`adr-card-btn ${isActive ? 'is-active' : ''}`}
                  onClick={() => onSelectDecision(adr.id)}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <div className="adr-card-top">
                    <span className="drawer-ticket-id">{adr.id}</span>
                    <span className={`gruvbox-badge ${statusMeta.badgeClass}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <div className="adr-card-title">{adr.title}</div>
                  <div className="adr-card-date">{adr.date}</div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <article className="decision-reader-panel" aria-labelledby="active-adr-heading">
        <header className="decision-reader-header">
          <div className="drawer-meta-badges">
            <span className="drawer-ticket-id">{activeDecision.id}</span>
            <span className={`gruvbox-badge ${activeBadge.badgeClass}`}>
              {activeBadge.label}
            </span>
            <span className="drawer-filepath">
              .jiraiya/decisions/{activeDecision.filename}
            </span>
          </div>
          <h2 id="active-adr-heading" className="decision-reader-title">
            {activeDecision.title}
          </h2>
          <span className="adr-card-date">Recorded on {activeDecision.date}</span>
        </header>

        <MarkdownView ast={activeDecision.ast} />
      </article>
    </div>
  );
};
