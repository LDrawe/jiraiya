import React, { useEffect, useRef, useState } from 'react';
import type {
  LoadedWorkspace,
  NewTicketInput,
  RegisteredProject,
  Ticket,
  TicketEditablePatch,
  TicketPriority,
  TicketStatus,
  TicketType,
} from './types/domain';
import {
  listRegisteredProjects,
  removeRegisteredProject,
  saveRegisteredProject,
} from './storage/handleStore';
import {
  checkJiraiyaDirectoryExists,
  createNewTicketSafely,
  initializeJiraiyaWorkspace,
  isFileSystemAccessSupported,
  loadJiraiyaWorkspace,
  saveTicketContentSafely,
} from './storage/workspaceFs';
import {
  serializeNewTicketMarkdown,
  toggleCriterionInRaw,
  updateTicketFieldsInRaw,
  updateTicketPriorityInRaw,
  updateTicketStatusInRaw,
} from './core/parser';
import {
  TICKET_PRIORITY_META,
  TICKET_TYPE_META,
} from './utils/ticketPresentation';
import { computeViewportSafeDropdownPosition } from './utils/topLayer';
import { Icon } from './components/Icon';
import { Sidebar, type ThemeMode, type WorkspaceSection } from './components/Sidebar';
import { KanbanBoard, type BoardViewMode } from './components/KanbanBoard';
import { TicketDrawer } from './components/TicketDrawer';
import { NewTicketDialog } from './components/NewTicketDialog';
import { DecisionsView } from './components/DecisionsView';
import { SettingsView } from './components/SettingsView';

type SortOption = 'id' | 'priority' | 'title' | 'progress' | 'modified';

type HeaderPopoverState = {
  kind: 'filter' | 'sort';
  top: number;
  left: number;
} | null;

const SORT_LABELS: Record<SortOption, string> = {
  id: 'Identifier (ID)',
  priority: 'Priority (Critical → Low)',
  title: 'Title (A–Z)',
  progress: 'Checklist progress',
  modified: 'Recently modified',
};

const FILTER_PRIORITIES: TicketPriority[] = ['critical', 'high', 'medium', 'low'];
const FILTER_TYPES: TicketType[] = ['lab', 'story', 'task', 'epic', 'bug'];

function readInitialTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem('jiraiya-theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // Ignore storage restriction
  }
  return 'dark';
}

export const App: React.FC = () => {
  const [projects, setProjects] = useState<RegisteredProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<LoadedWorkspace | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const [activeSection, setActiveSection] = useState<WorkspaceSection>('workspace');
  const [viewMode, setViewMode] = useState<BoardViewMode>('board');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [selectedTicketFilename, setSelectedTicketFilename] = useState<string | null>(null);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [newTaskModalStatus, setNewTaskModalStatus] = useState<TicketStatus | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TicketType | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string | 'all'>('all');
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('id');
  const [headerPopover, setHeaderPopover] = useState<HeaderPopoverState>(null);

  const [pendingInitHandle, setPendingInitHandle] = useState<FileSystemDirectoryHandle | null>(
    null
  );
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const fsSupported = isFileSystemAccessSupported();

  // Sincroniza atributo data-theme do documento com o estado atual
  useEffect(() => {
    document.body.dataset.theme = theme;
    try {
      window.localStorage.setItem('jiraiya-theme', theme);
    } catch {
      // Ignore storage restriction
    }
  }, [theme]);

  // Atalho global Cmd/Ctrl + K para focar a busca de tasks
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (searchInputRef.current) {
          e.preventDefault();
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      } else if (e.key === 'Escape' && headerPopover) {
        setHeaderPopover(null);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [headerPopover]);

  async function loadWorkspaceFromGrantedProject(project: RegisteredProject): Promise<void> {
    const exists = await checkJiraiyaDirectoryExists(project.handle);
    if (!exists) {
      setWorkspace(null);
      setPendingInitHandle(project.handle);
      return;
    }

    const loaded = await loadJiraiyaWorkspace(project.handle);
    setWorkspace(loaded);
    setLastSyncedAt(Date.now());

    const doneCount = loaded.tickets.filter((t) => t.status === 'done').length;
    const updatedRecord: RegisteredProject = {
      ...project,
      name: loaded.config.name || project.name,
      permissionState: 'granted',
      ticketCount: loaded.tickets.length,
      doneCount,
    };

    await saveRegisteredProject(updatedRecord);
    setProjects((prev) => prev.map((p) => (p.id === project.id ? updatedRecord : p)));
  }

  // Carrega ponteiros de diretórios salvos no IndexedDB
  useEffect(() => {
    let cancelled = false;

    listRegisteredProjects()
      .then(async (list) => {
        if (cancelled) return;
        setProjects(list);
        if (list.length > 0) {
          const first = list[0];
          setActiveProjectId(first.id);
          if (first.permissionState === 'granted') {
            setIsLoading(true);
            try {
              await loadWorkspaceFromGrantedProject(first);
            } catch (err) {
              if (!cancelled) {
                setErrorBanner(
                  err instanceof Error
                    ? err.message
                    : 'Failed to load local project files.'
                );
              }
            } finally {
              if (!cancelled) {
                setIsLoading(false);
              }
            }
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorBanner(`Failed to read registered projects: ${String(err)}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const selectedTicket =
    workspace?.tickets.find((t) => t.filename === selectedTicketFilename) ?? null;

  async function openAndLoadProject(project: RegisteredProject): Promise<void> {
    setErrorBanner(null);
    setPendingInitHandle(null);
    setIsLoading(true);

    try {
      let perm = await project.handle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        perm = await project.handle.requestPermission({ mode: 'readwrite' });
      }

      if (perm !== 'granted') {
        const updatedProj: RegisteredProject = { ...project, permissionState: perm };
        setProjects((prev) => prev.map((p) => (p.id === project.id ? updatedProj : p)));
        setWorkspace(null);
        setErrorBanner(
          `Permission denied to access folder "${project.name}". Authorize read and write access to open local files.`
        );
        return;
      }

      await loadWorkspaceFromGrantedProject(project);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Unexpected error reading local files.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddProjectDirectory(): Promise<void> {
    if (!fsSupported) {
      setErrorBanner(
        'Your browser does not support the File System Access API (showDirectoryPicker). Please use a Chromium-based desktop browser (Chrome, Edge, or Brave).'
      );
      return;
    }

    setErrorBanner(null);
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const id = `proj_${dirHandle.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

      const newProj: RegisteredProject = {
        id,
        name: dirHandle.name,
        handle: dirHandle,
        permissionState: 'granted',
      };

      await saveRegisteredProject(newProj);
      setProjects((prev) => {
        const filtered = prev.filter((p) => p.id !== id);
        return [newProj, ...filtered];
      });
      setActiveProjectId(id);
      setActiveSection('workspace');
      setSelectedTicketFilename(null);
      await openAndLoadProject(newProj);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setErrorBanner(
        err instanceof Error ? err.message : 'Unable to select directory.'
      );
    }
  }

  async function handleInitializeJiraiyaFolder(): Promise<void> {
    if (!pendingInitHandle || !activeProject) return;
    setIsLoading(true);
    setErrorBanner(null);
    try {
      await initializeJiraiyaWorkspace(pendingInitHandle);
      setPendingInitHandle(null);
      await openAndLoadProject(activeProject);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Failed to initialize .jiraiya/ structure.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectProjectFromSidebar(id: string): Promise<void> {
    setActiveSection('workspace');
    if (id === activeProjectId && workspace) {
      return;
    }
    setActiveProjectId(id);
    setSelectedTicketFilename(null);
    setSelectedDecisionId(null);
    const target = projects.find((p) => p.id === id);
    if (target) {
      await openAndLoadProject(target);
    }
  }

  async function handleRemoveProject(id: string): Promise<void> {
    await removeRegisteredProject(id);
    const remaining = projects.filter((p) => p.id !== id);
    setProjects(remaining);
    if (activeProjectId === id) {
      setWorkspace(null);
      setPendingInitHandle(null);
      setSelectedTicketFilename(null);
      const nextProj = remaining[0] ?? null;
      setActiveProjectId(nextProj ? nextProj.id : null);
      if (nextProj && nextProj.permissionState === 'granted') {
        void openAndLoadProject(nextProj);
      }
    }
  }

  async function persistTicketMutation(
    ticket: Ticket,
    updatedRaw: string,
    fallbackErrorMessage: string
  ): Promise<void> {
    if (!activeProject || !workspace) return;
    setErrorBanner(null);

    try {
      const savedTicket = await saveTicketContentSafely(
        activeProject.handle,
        ticket.filename,
        ticket.lastModified,
        updatedRaw
      );

      const updatedTickets = workspace.tickets.map((t) =>
        t.filename === ticket.filename ? savedTicket : t
      );
      setWorkspace({ ...workspace, tickets: updatedTickets });
      setLastSyncedAt(Date.now());

      const doneCount = updatedTickets.filter((t) => t.status === 'done').length;
      if (
        activeProject.doneCount !== doneCount ||
        activeProject.ticketCount !== updatedTickets.length
      ) {
        const updatedProject: RegisteredProject = {
          ...activeProject,
          ticketCount: updatedTickets.length,
          doneCount,
        };
        await saveRegisteredProject(updatedProject);
        setProjects((prev) =>
          prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
        );
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : fallbackErrorMessage);
    }
  }

  async function handleTicketStatusChange(
    ticket: Ticket,
    nextStatus: TicketStatus
  ): Promise<void> {
    const updatedRaw = updateTicketStatusInRaw(ticket.rawContent, nextStatus);
    await persistTicketMutation(
      ticket,
      updatedRaw,
      'Error saving status change to file.'
    );
  }

  async function handleTicketPriorityChange(
    ticket: Ticket,
    nextPriority: TicketPriority
  ): Promise<void> {
    const updatedRaw = updateTicketPriorityInRaw(ticket.rawContent, nextPriority);
    await persistTicketMutation(
      ticket,
      updatedRaw,
      'Error saving priority change to file.'
    );
  }

  async function handleUpdateTicketFields(
    ticket: Ticket,
    patch: TicketEditablePatch
  ): Promise<void> {
    const updatedRaw = updateTicketFieldsInRaw(ticket.rawContent, patch);
    await persistTicketMutation(
      ticket,
      updatedRaw,
      'Error saving ticket changes to file.'
    );
  }

  async function handleToggleCriterion(
    ticket: Ticket,
    criterionIndex: number
  ): Promise<void> {
    const updatedRaw = toggleCriterionInRaw(ticket.rawContent, criterionIndex);
    await persistTicketMutation(
      ticket,
      updatedRaw,
      'Error saving acceptance criterion to file.'
    );
  }

  async function handleCreateTicket(input: NewTicketInput): Promise<void> {
    if (!activeProject || !workspace) return;
    setErrorBanner(null);

    const markdownContent = serializeNewTicketMarkdown(input);
    const createdTicket = await createNewTicketSafely(
      activeProject.handle,
      input.id,
      markdownContent
    );

    const updatedTickets = [...workspace.tickets, createdTicket].sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true })
    );
    setWorkspace({ ...workspace, tickets: updatedTickets });
    setLastSyncedAt(Date.now());

    const doneCount = updatedTickets.filter((t) => t.status === 'done').length;
    const updatedProject: RegisteredProject = {
      ...activeProject,
      ticketCount: updatedTickets.length,
      doneCount,
    };
    await saveRegisteredProject(updatedProject);
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    );
    setSelectedTicketFilename(createdTicket.filename);
  }

  function clearAllFilters(): void {
    setSearchQuery('');
    setPriorityFilter('all');
    setTypeFilter('all');
    setTagFilter('all');
    setBlockedOnly(false);
  }

  function toggleHeaderPopover(
    e: React.MouseEvent<HTMLButtonElement>,
    kind: 'filter' | 'sort'
  ): void {
    if (headerPopover?.kind === kind) {
      setHeaderPopover(null);
      return;
    }
    const pos = computeViewportSafeDropdownPosition(
      e.currentTarget,
      268,
      kind === 'filter' ? 360 : 250,
      true
    );
    setHeaderPopover({ kind, top: pos.top, left: pos.left });
  }

  // Estado derivado (zero useEffect para cálculos derivados)
  const allTickets = workspace?.tickets ?? [];
  const totalTicketsCount = allTickets.length;
  const doneTicketsCount = allTickets.filter((t) => t.status === 'done').length;
  const completionPercent =
    totalTicketsCount > 0 ? Math.round((doneTicketsCount / totalTicketsCount) * 100) : 0;

  const doneTicketIds = new Set(
    allTickets.filter((t) => t.status === 'done').map((t) => t.id.toUpperCase())
  );

  const availableTags = Array.from(new Set(allTickets.flatMap((t) => t.tags))).sort((a, b) =>
    a.localeCompare(b)
  );

  const activeFilterCount =
    (priorityFilter !== 'all' ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0) +
    (tagFilter !== 'all' ? 1 : 0) +
    (blockedOnly ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0 || searchQuery.trim().length > 0;

  const visibleTickets = allTickets
    .filter((ticket) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchesQuery =
          ticket.id.toLowerCase().includes(q) ||
          ticket.title.toLowerCase().includes(q) ||
          ticket.summary.toLowerCase().includes(q) ||
          ticket.tags.some((t) => t.toLowerCase().includes(q)) ||
          ticket.concepts.some((c) => c.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) {
        return false;
      }
      if (typeFilter !== 'all' && ticket.type !== typeFilter) {
        return false;
      }
      if (tagFilter !== 'all' && !ticket.tags.includes(tagFilter)) {
        return false;
      }
      if (blockedOnly) {
        const hasUnresolved = ticket.dependencies.some(
          (dep) => !doneTicketIds.has(dep.toUpperCase())
        );
        if (!hasUnresolved || ticket.status === 'done') return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'priority': {
          const diff =
            TICKET_PRIORITY_META[b.priority].weight -
            TICKET_PRIORITY_META[a.priority].weight;
          return diff !== 0
            ? diff
            : a.id.localeCompare(b.id, undefined, { numeric: true });
        }
        case 'title':
          return a.title.localeCompare(b.title);
        case 'progress': {
          const ratioA =
            a.acceptanceCriteria.length > 0
              ? a.acceptanceCriteria.filter((c) => c.completed).length /
                a.acceptanceCriteria.length
              : -1;
          const ratioB =
            b.acceptanceCriteria.length > 0
              ? b.acceptanceCriteria.filter((c) => c.completed).length /
                b.acceptanceCriteria.length
              : -1;
          return ratioB - ratioA;
        }
        case 'modified':
          return b.lastModified - a.lastModified;
        case 'id':
        default:
          return a.id.localeCompare(b.id, undefined, { numeric: true });
      }
    });

  const branchLabel = workspace?.gitBranch ?? 'local';

  const headerTitle =
    activeSection === 'settings'
      ? 'Settings'
      : workspace?.config.name ?? activeProject?.name ?? 'Jiraiya';

  const headerSubtitle =
    activeSection === 'settings'
      ? 'Manage connected local repositories via File System Access API and workspace appearance.'
      : workspace?.config.description
        ? workspace.config.description
        : activeProject
          ? 'Local-first workspace connected directly to the repository’s .jiraiya/ folder.'
          : 'Connect a local directory to manage tasks and architectural decisions directly in Markdown files.';

  return (
    <div className="app-shell">
      <Sidebar
        projects={projects}
        activeProjectId={activeProjectId}
        activeSection={activeSection}
        theme={theme}
        decisionCount={workspace ? workspace.decisions.length : undefined}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onSelectProject={(id) => void handleSelectProjectFromSidebar(id)}
        onAddProject={() => void handleAddProjectDirectory()}
        onRemoveProject={(id) => void handleRemoveProject(id)}
        onChangeSection={setActiveSection}
        onChangeTheme={setTheme}
      />

      <main className="project-workspace">
        {/* Board Header (#6:339) */}
        <header className="board-header">
          {/* Project overview (#6:354) */}
          <div className="project-overview">
            <div className="project-identity-actions">
              <div className="project-identity">
                <div className="project-title-row">
                  <button
                    type="button"
                    className="mobile-menu-trigger"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    aria-label="Open navigation"
                  >
                    <Icon name="menu" size={18} />
                  </button>

                  <h1 className="project-title">{headerTitle}</h1>

                  {activeSection !== 'settings' && activeProject && (
                    <>
                      <span className="badge-branch" title="Branch detected in .git/HEAD">
                        <Icon name="git-branch-11" size={11} />
                        <span>{branchLabel}</span>
                      </span>

                      {workspace ? (
                        <span className="gruvbox-badge badge-green">Active</span>
                      ) : pendingInitHandle ? (
                        <span className="gruvbox-badge badge-orange">Setup required</span>
                      ) : (
                        <span className="gruvbox-badge badge-yellow">Permission needed</span>
                      )}
                    </>
                  )}
                </div>

                <p className="project-subtitle">{headerSubtitle}</p>
              </div>

              {/* Repository actions (#35:3) */}
              <div className="repository-actions">
                {activeSection === 'workspace' && workspace ? (
                  <>
                    <div className="search-pill-input">
                      <span className="search-pill-icon">
                        <Icon name="search" size={16} />
                      </span>
                      <input
                        ref={searchInputRef}
                        type="search"
                        className="search-pill-field"
                        placeholder="Search tasks..."
                        aria-label="Search tasks"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      {searchQuery ? (
                        <button
                          type="button"
                          className="search-clear-btn"
                          onClick={() => setSearchQuery('')}
                          aria-label="Clear search"
                        >
                          <Icon name="close" size={13} />
                        </button>
                      ) : (
                        <span className="search-kbd-hint" aria-hidden="true">
                          ⌘K
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="btn-primary-pill"
                      onClick={() => setNewTaskModalStatus('ready')}
                    >
                      <span className="btn-plus-icon">
                        <Icon name="plus-18" size={18} />
                      </span>
                      <span>New task</span>
                    </button>
                  </>
                ) : activeSection === 'decisions' ? (
                  <button
                    type="button"
                    className="btn-outline-pill"
                    onClick={() => setActiveSection('workspace')}
                  >
                    <Icon name="columns-3" size={16} />
                    <span>Board</span>
                  </button>
                ) : !activeProject && activeSection !== 'settings' ? (
                  <button
                    type="button"
                    className="btn-primary-pill"
                    onClick={() => void handleAddProjectDirectory()}
                  >
                    <span className="btn-plus-icon">
                      <Icon name="plus-18" size={18} />
                    </span>
                    <span>Open repository</span>
                  </button>
                ) : null}
              </div>
            </div>

            {/* Project context (#6:377) */}
            {activeSection !== 'settings' && workspace && (
              <div className="project-context-row">
                <div className="completion-summary">
                  <div
                    className="completion-track"
                    role="progressbar"
                    aria-valuenow={doneTicketsCount}
                    aria-valuemin={0}
                    aria-valuemax={Math.max(1, totalTicketsCount)}
                    aria-label="Completed tasks progress"
                  >
                    <div
                      className="completion-fill"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                  <span className="completion-label">
                    {doneTicketsCount} of {totalTicketsCount}{' '}
                    {totalTicketsCount === 1 ? 'task' : 'tasks'} complete
                  </span>
                </div>

                <button
                  type="button"
                  className="context-link-btn"
                  onClick={() =>
                    setActiveSection(activeSection === 'decisions' ? 'workspace' : 'decisions')
                  }
                >
                  <Icon name="book-open" size={14} />
                  <span>
                    {workspace.decisions.length}{' '}
                    {workspace.decisions.length === 1 ? 'decision (ADR)' : 'decisions (ADRs)'}
                  </span>
                </button>

                {activeProject && (
                  <button
                    type="button"
                    className="context-link-btn"
                    onClick={() => void openAndLoadProject(activeProject)}
                    disabled={isLoading}
                    title="Reload .jiraiya/ files from disk"
                  >
                    <Icon name="refresh" size={13} />
                    <span>{isLoading ? 'Syncing...' : 'Sync files'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Board controls (#6:385) */}
          {activeSection === 'workspace' && workspace && (
            <div className="board-controls-bar">
              {/* Control/Board views (#35:272) */}
              <div className="view-switcher" role="group" aria-label="Task view mode">
                <button
                  type="button"
                  className={`view-option-btn ${viewMode === 'board' ? 'is-active' : ''}`}
                  onClick={() => setViewMode('board')}
                  aria-pressed={viewMode === 'board'}
                >
                  <Icon name="columns-3" size={16} />
                  <span>Board</span>
                </button>

                <button
                  type="button"
                  className={`view-option-btn ${viewMode === 'list' ? 'is-active' : ''}`}
                  onClick={() => setViewMode('list')}
                  aria-pressed={viewMode === 'list'}
                >
                  <Icon name="list" size={16} />
                  <span>List</span>
                </button>

                <button
                  type="button"
                  className="view-option-btn"
                  disabled
                  title="Unavailable: local tickets in .jiraiya/ do not have schedule dates"
                >
                  <Icon name="calendar" size={16} />
                  <span>Timeline</span>
                </button>
              </div>

              {/* Task controls (#6:399) */}
              <div className="task-controls-group">
                <button
                  type="button"
                  className={`btn-outline-pill ${activeFilterCount > 0 || headerPopover?.kind === 'filter' ? 'is-active' : ''}`}
                  onClick={(e) => toggleHeaderPopover(e, 'filter')}
                  aria-expanded={headerPopover?.kind === 'filter'}
                  aria-haspopup="dialog"
                >
                  <Icon name="list-filter" size={18} />
                  <span>Filter</span>
                  {activeFilterCount > 0 && (
                    <span className="pill-active-dot">{activeFilterCount}</span>
                  )}
                </button>

                <button
                  type="button"
                  className={`btn-outline-pill ${sortBy !== 'id' || headerPopover?.kind === 'sort' ? 'is-active' : ''}`}
                  onClick={(e) => toggleHeaderPopover(e, 'sort')}
                  aria-expanded={headerPopover?.kind === 'sort'}
                  aria-haspopup="menu"
                >
                  <Icon name="arrow-down-up" size={18} />
                  <span>Sort</span>
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Banners & Alerts */}
        {!fsSupported && (
          <div className="workspace-banner" role="alert">
            <span className="workspace-banner-icon">
              <Icon name="alert" size={16} />
            </span>
            <div className="workspace-banner-text">
              <strong>File System Access API unavailable in this browser:</strong> To read and
              write directly to your local <code className="inline-code">.jiraiya/</code> folder,
              please use Google Chrome, Microsoft Edge, or Brave on Desktop.
            </div>
          </div>
        )}

        {errorBanner && (
          <div className="workspace-banner" role="alert">
            <span className="workspace-banner-icon">
              <Icon name="alert" size={16} />
            </span>
            <div className="workspace-banner-text">{errorBanner}</div>
            <button
              type="button"
              className="workspace-banner-close"
              onClick={() => setErrorBanner(null)}
              aria-label="Close alert"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        )}

        {/* Workspace Stage */}
        <div className="workspace-stage">
          {activeSection === 'settings' ? (
            <SettingsView
              projects={projects}
              activeProjectId={activeProjectId}
              theme={theme}
              onChangeTheme={setTheme}
              onReauthorize={(proj) => {
                setActiveProjectId(proj.id);
                setActiveSection('workspace');
                void openAndLoadProject(proj);
              }}
              onRemoveProject={(id) => void handleRemoveProject(id)}
              onAddProject={() => void handleAddProjectDirectory()}
            />
          ) : !activeProject ? (
            <div className="onboarding-stage">
              <div className="onboarding-card">
                <div className="onboarding-emblem" aria-hidden="true">
                  <Icon name="folder-plus" size={22} />
                </div>
                <h2 className="onboarding-title">
                  Select a local repository to get started
                </h2>
                <p className="onboarding-desc">
                  <strong>Jiraiya</strong> reads and writes tasks and architectural decisions directly
                  to Markdown files inside your project&rsquo;s{' '}
                  <code className="inline-code">.jiraiya/</code> folder. No cloud, no external database.
                </p>
                <button
                  type="button"
                  className="btn-primary-pill"
                  onClick={() => void handleAddProjectDirectory()}
                >
                  <span className="btn-plus-icon">
                    <Icon name="plus-18" size={18} />
                  </span>
                  <span>Select project folder</span>
                </button>
              </div>
            </div>
          ) : pendingInitHandle ? (
            <div className="onboarding-stage">
              <div className="onboarding-card">
                <div className="onboarding-emblem" aria-hidden="true">
                  <Icon name="layers-2" size={22} />
                </div>
                <h2 className="onboarding-title">
                  .jiraiya/ structure not found in &ldquo;{activeProject.name}&rdquo;
                </h2>
                <p className="onboarding-desc">
                  Would you like to initialize the <code className="inline-code">.jiraiya/</code>{' '}
                  directory (with <code className="inline-code">config.json</code>,{' '}
                  <code className="inline-code">tickets/</code>,{' '}
                  <code className="inline-code">decisions/</code>, and{' '}
                  <code className="inline-code">reviews/</code>) with initial sample tasks and ADR?
                </p>
                <button
                  type="button"
                  className="btn-primary-pill"
                  onClick={() => void handleInitializeJiraiyaFolder()}
                  disabled={isLoading}
                >
                  <Icon name="check" size={14} />
                  <span>{isLoading ? 'Initializing...' : 'Initialize .jiraiya/ now'}</span>
                </button>
              </div>
            </div>
          ) : isLoading && !workspace ? (
            <div className="onboarding-stage">
              <div className="onboarding-card">
                <div className="onboarding-emblem" aria-hidden="true">
                  <Icon name="refresh" size={20} />
                </div>
                <h2 className="onboarding-title">Reading local files...</h2>
                <p className="onboarding-desc">
                  Loading tasks and architectural decisions from{' '}
                  <code className="inline-code">.jiraiya/</code> in &ldquo;{activeProject.name}
                  &rdquo;.
                </p>
              </div>
            </div>
          ) : !workspace ? (
            <div className="onboarding-stage">
              <div className="onboarding-card">
                <div className="onboarding-emblem" aria-hidden="true">
                  <Icon name="lock" size={20} />
                </div>
                <h2 className="onboarding-title">
                  Authorize access to folder &ldquo;{activeProject.name}&rdquo;
                </h2>
                <p className="onboarding-desc">
                  For browser security, please confirm read and write permissions on the local
                  folder to synchronize Markdown files in{' '}
                  <code className="inline-code">.jiraiya/</code>.
                </p>
                <button
                  type="button"
                  className="btn-primary-pill"
                  onClick={() => void openAndLoadProject(activeProject)}
                  disabled={isLoading}
                >
                  <Icon name="key" size={15} />
                  <span>Authorize and load workspace</span>
                </button>
              </div>
            </div>
          ) : activeSection === 'decisions' ? (
            <DecisionsView
              decisions={workspace.decisions}
              selectedDecisionId={selectedDecisionId}
              onSelectDecision={setSelectedDecisionId}
              onBackToBoard={() => setActiveSection('workspace')}
            />
          ) : (
            <KanbanBoard
              tickets={visibleTickets}
              allTickets={workspace.tickets}
              viewMode={viewMode}
              selectedTicketId={selectedTicket?.id ?? null}
              branchLabel={branchLabel}
              lastSyncedAt={lastSyncedAt}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearAllFilters}
              onSelectTicket={(ticket) => setSelectedTicketFilename(ticket.filename)}
              onStatusChange={(ticket, nextStatus) =>
                void handleTicketStatusChange(ticket, nextStatus)
              }
              onPriorityChange={(ticket, nextPriority) =>
                void handleTicketPriorityChange(ticket, nextPriority)
              }
              onAddTaskInColumn={(status) => setNewTaskModalStatus(status)}
            />
          )}
        </div>

        {/* Popovers de Filter e Sort */}
        {headerPopover && (
          <>
            <div
              className="floating-dropdown-backdrop"
              onClick={() => setHeaderPopover(null)}
              aria-hidden="true"
            />
            <div
              className="floating-dropdown-panel"
              style={{
                top: `${headerPopover.top}px`,
                left: `${headerPopover.left}px`,
              }}
              role={headerPopover.kind === 'sort' ? 'menu' : 'dialog'}
              aria-label={
                headerPopover.kind === 'filter' ? 'Filter tasks' : 'Sort tasks'
              }
            >
              {headerPopover.kind === 'filter' ? (
                <>
                  <div className="dropdown-section">
                    <span className="dropdown-section-title">Priority</span>
                    <div className="dropdown-chip-grid">
                      {FILTER_PRIORITIES.map((prio) => {
                        const selected = priorityFilter === prio;
                        return (
                          <button
                            key={prio}
                            type="button"
                            className={`dropdown-chip-btn ${selected ? 'is-selected' : ''}`}
                            onClick={() => setPriorityFilter(selected ? 'all' : prio)}
                            aria-pressed={selected}
                          >
                            <Icon name="flag" size={11} />
                            <span>{TICKET_PRIORITY_META[prio].label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="dropdown-section">
                    <span className="dropdown-section-title">Type</span>
                    <div className="dropdown-chip-grid">
                      {FILTER_TYPES.map((t) => {
                        const selected = typeFilter === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            className={`dropdown-chip-btn ${selected ? 'is-selected' : ''}`}
                            onClick={() => setTypeFilter(selected ? 'all' : t)}
                            aria-pressed={selected}
                          >
                            <span>{TICKET_TYPE_META[t].label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {availableTags.length > 0 && (
                    <div className="dropdown-section">
                      <span className="dropdown-section-title">Tag</span>
                      <div className="dropdown-chip-grid">
                        {availableTags.map((tag) => {
                          const selected = tagFilter === tag;
                          return (
                            <button
                              key={tag}
                              type="button"
                              className={`dropdown-chip-btn ${selected ? 'is-selected' : ''}`}
                              onClick={() => setTagFilter(selected ? 'all' : tag)}
                              aria-pressed={selected}
                            >
                              <span>#{tag}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="dropdown-divider" />

                  <button
                    type="button"
                    className={`dropdown-option-btn ${blockedOnly ? 'is-selected' : ''}`}
                    onClick={() => setBlockedOnly((prev) => !prev)}
                    aria-pressed={blockedOnly}
                  >
                    <span>Blocked only</span>
                    {blockedOnly && <Icon name="check" size={13} />}
                  </button>

                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      className="dropdown-option-btn"
                      onClick={() => {
                        setPriorityFilter('all');
                        setTypeFilter('all');
                        setTagFilter('all');
                        setBlockedOnly(false);
                      }}
                    >
                      <span>Clear filters</span>
                      <Icon name="close" size={13} />
                    </button>
                  )}
                </>
              ) : (
                <div className="dropdown-section">
                  <span className="dropdown-section-title">Sort by</span>
                  {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => {
                    const selected = sortBy === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        className={`dropdown-option-btn ${selected ? 'is-selected' : ''}`}
                        onClick={() => {
                          setSortBy(opt);
                          setHeaderPopover(null);
                        }}
                      >
                        <span>{SORT_LABELS[opt]}</span>
                        {selected && <Icon name="check" size={13} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Modal Slide-Over de Detalhes/Edição do Ticket */}
        <TicketDrawer
          ticket={selectedTicket}
          allTickets={allTickets}
          onClose={() => setSelectedTicketFilename(null)}
          onStatusChange={handleTicketStatusChange}
          onPriorityChange={handleTicketPriorityChange}
          onUpdateFields={handleUpdateTicketFields}
          onToggleCriterion={handleToggleCriterion}
          onSelectTicket={(t) => setSelectedTicketFilename(t.filename)}
          onNavigateDecision={(decisionId) => {
            setSelectedTicketFilename(null);
            setSelectedDecisionId(decisionId);
            setActiveSection('decisions');
          }}
        />

        {/* Modal de Criação de Nova Task em .jiraiya/tickets/ */}
        <NewTicketDialog
          isOpen={newTaskModalStatus !== null}
          initialStatus={newTaskModalStatus ?? 'ready'}
          existingTickets={allTickets}
          onClose={() => setNewTaskModalStatus(null)}
          onCreateTicket={handleCreateTicket}
        />
      </main>
    </div>
  );
};
