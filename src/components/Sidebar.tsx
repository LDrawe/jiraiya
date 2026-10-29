import React from 'react';
import type { RegisteredProject } from '../types/domain';
import { Icon, pickRepositoryIcon } from './Icon';

export type WorkspaceSection = 'workspace' | 'decisions' | 'settings';
export type ThemeMode = 'dark' | 'light';

interface SidebarProps {
  projects: RegisteredProject[];
  activeProjectId: string | null;
  activeSection: WorkspaceSection;
  theme: ThemeMode;
  decisionCount?: number;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectProject: (id: string) => void;
  onAddProject: () => void;
  onRemoveProject: (id: string) => void;
  onChangeSection: (section: WorkspaceSection) => void;
  onChangeTheme: (theme: ThemeMode) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  projects,
  activeProjectId,
  activeSection,
  theme,
  decisionCount,
  isMobileOpen,
  onCloseMobile,
  onSelectProject,
  onAddProject,
  onRemoveProject,
  onChangeSection,
  onChangeTheme,
}) => {
  return (
    <>
      <div
        className={`mobile-sidebar-backdrop ${isMobileOpen ? 'is-open' : ''}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />
      <aside
        className={`workspace-sidebar ${isMobileOpen ? 'is-mobile-open' : ''}`}
        aria-label="Workspace navigation"
      >
        {/* Brand (#6:282) */}
        <div className="sidebar-brand-row">
          <div className="brand-identity">
            <div className="brand-emblem" aria-hidden="true">
              <Icon name="layers-2" size={22} />
            </div>
            <span className="brand-wordmark">Jiraiya</span>
          </div>

          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Control/Theme (#35:264) */}
        <div className="theme-switcher" role="group" aria-label="Theme mode">
          <button
            type="button"
            className={`theme-option-btn ${theme === 'light' ? 'is-active' : ''}`}
            onClick={() => onChangeTheme('light')}
            aria-pressed={theme === 'light'}
            aria-label="Light theme"
            title="Light theme (Gruvbox Warm Paper)"
          >
            <Icon name="sun" size={16} />
          </button>
          <button
            type="button"
            className={`theme-option-btn ${theme === 'dark' ? 'is-active' : ''}`}
            onClick={() => onChangeTheme('dark')}
            aria-pressed={theme === 'dark'}
            aria-label="Dark theme"
            title="Dark theme (Gruvbox Dark)"
          >
            <Icon name="moon" size={16} />
          </button>
        </div>

        {/* Repositories (#8:9) */}
        <div className="sidebar-repositories">
          <div className="sidebar-section-heading">
            <span className="sidebar-section-label">Repositories</span>
            <button
              type="button"
              className="sidebar-icon-action"
              onClick={onAddProject}
              title="Add local project directory (.jiraiya)"
              aria-label="Add local repository"
            >
              <Icon name="plus" size={16} />
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="sidebar-empty-repos">
              No local repository connected. Click <strong>+</strong> to open a folder.
            </div>
          ) : (
            <ul className="repo-links-list">
              {projects.map((proj, index) => {
                const isSelected =
                  proj.id === activeProjectId && activeSection === 'workspace';
                const repoIcon = pickRepositoryIcon(proj.id, index);
                return (
                  <li
                    key={proj.id}
                    className={`repo-link-row ${isSelected ? 'is-active' : ''}`}
                  >
                    <button
                      type="button"
                      className="repo-nav-btn"
                      onClick={() => {
                        onSelectProject(proj.id);
                        onCloseMobile();
                      }}
                      aria-current={isSelected ? 'page' : undefined}
                      title={
                        proj.ticketCount !== undefined
                          ? `${proj.name} (${proj.doneCount ?? 0}/${proj.ticketCount} completed)`
                          : proj.name
                      }
                    >
                      <span className="repo-nav-icon">
                        <Icon name={repoIcon} size={20} />
                      </span>
                      <span className="repo-nav-label">{proj.name}</span>
                      {proj.permissionState !== 'granted' && (
                        <span
                          className="repo-lock-hint"
                          title="Requires read/write authorization in this session"
                        >
                          <Icon name="lock" size={13} />
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      className="repo-unlink-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveProject(proj.id);
                      }}
                      title={`Remove ${proj.name} from list (does not delete files)`}
                      aria-label={`Remove ${proj.name}`}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="sidebar-spacer" />

        {/* Account / Workspace Bottom Controls (#8:30) */}
        <nav className="sidebar-bottom-controls" aria-label="Project resources and settings">
          <button
            type="button"
            className={`sidebar-nav-pill ${activeSection === 'decisions' ? 'is-active' : ''}`}
            onClick={() => {
              onChangeSection('decisions');
              onCloseMobile();
            }}
            aria-current={activeSection === 'decisions' ? 'page' : undefined}
          >
            <span className="repo-nav-icon">
              <Icon name="book-open" size={20} />
            </span>
            <span className="repo-nav-label">Decisions</span>
            {decisionCount !== undefined && (
              <span className="sidebar-pill-count">{decisionCount}</span>
            )}
          </button>

          <button
            type="button"
            className={`sidebar-nav-pill ${activeSection === 'settings' ? 'is-active' : ''}`}
            onClick={() => {
              onChangeSection('settings');
              onCloseMobile();
            }}
            aria-current={activeSection === 'settings' ? 'page' : undefined}
          >
            <span className="repo-nav-icon">
              <Icon name="settings-2" size={20} />
            </span>
            <span className="repo-nav-label">Settings</span>
          </button>
        </nav>
      </aside>
    </>
  );
};
