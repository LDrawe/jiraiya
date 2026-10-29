import React from 'react';
import type { RegisteredProject } from '../types/domain';
import { Icon } from './Icon';
import type { ThemeMode } from './Sidebar';

interface SettingsViewProps {
  projects: RegisteredProject[];
  activeProjectId: string | null;
  theme: ThemeMode;
  onChangeTheme: (theme: ThemeMode) => void;
  onReauthorize: (project: RegisteredProject) => void;
  onRemoveProject: (id: string) => void;
  onAddProject: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  projects,
  activeProjectId,
  theme,
  onChangeTheme,
  onReauthorize,
  onRemoveProject,
  onAddProject,
}) => {
  return (
    <div className="settings-stage">
      <section className="settings-panel-card" aria-labelledby="settings-repos-heading">
        <div>
          <h2 id="settings-repos-heading" className="settings-panel-title">
            Connected Local Repositories
          </h2>
          <p className="settings-panel-desc">
            Markdown files in <code className="inline-code">.jiraiya/</code> are the single source of
            truth. Disconnecting a repository only clears the stored handle in your browser
            (IndexedDB) and never deletes local files from disk.
          </p>
        </div>

        <div>
          <button type="button" className="btn-primary-pill" onClick={onAddProject}>
            <span className="btn-plus-icon">
              <Icon name="plus-18" size={18} />
            </span>
            <span>Connect local folder</span>
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="column-empty-placeholder">
            No local repositories registered in this browser.
          </div>
        ) : (
          <div className="settings-repo-list">
            {projects.map((proj) => {
              const isGranted = proj.permissionState === 'granted';
              return (
                <div key={proj.id} className="settings-repo-item">
                  <div className="settings-repo-meta">
                    <div className="drawer-meta-badges">
                      <strong>{proj.name}</strong>
                      {proj.id === activeProjectId && (
                        <span className="gruvbox-badge badge-aqua">Active</span>
                      )}
                      <span
                        className={`gruvbox-badge ${isGranted ? 'badge-green' : 'badge-yellow'}`}
                      >
                        {isGranted ? 'Read & write authorized' : 'Session authorization required'}
                      </span>
                    </div>
                    {proj.ticketCount !== undefined && (
                      <span className="adr-card-date">
                        {proj.ticketCount} {proj.ticketCount === 1 ? 'task' : 'tasks'} ·{' '}
                        {proj.doneCount ?? 0} completed
                      </span>
                    )}
                  </div>

                  <div className="settings-repo-actions">
                    {!isGranted && (
                      <button
                        type="button"
                        className="btn-outline-pill"
                        onClick={() => onReauthorize(proj)}
                      >
                        <Icon name="key" size={15} />
                        <span>Authorize</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-outline-pill"
                      onClick={() => onRemoveProject(proj.id)}
                    >
                      <Icon name="trash" size={15} />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="settings-panel-card" aria-labelledby="settings-theme-heading">
        <div>
          <h2 id="settings-theme-heading" className="settings-panel-title">
            Workspace Appearance
          </h2>
          <p className="settings-panel-desc">
            Gruvbox palette optimized for reduced eye strain during extended engineering sessions.
          </p>
        </div>

        <div className="settings-repo-actions">
          <button
            type="button"
            className={`btn-outline-pill ${theme === 'dark' ? 'is-active' : ''}`}
            onClick={() => onChangeTheme('dark')}
            aria-pressed={theme === 'dark'}
          >
            <Icon name="moon" size={16} />
            <span>Gruvbox Dark</span>
          </button>
          <button
            type="button"
            className={`btn-outline-pill ${theme === 'light' ? 'is-active' : ''}`}
            onClick={() => onChangeTheme('light')}
            aria-pressed={theme === 'light'}
          >
            <Icon name="sun" size={16} />
            <span>Gruvbox Warm Light</span>
          </button>
        </div>
      </section>
    </div>
  );
};
