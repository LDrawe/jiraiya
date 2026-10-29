import type {
  LoadedWorkspace,
  ProjectConfig,
  Ticket,
  ArchitectureDecision,
} from '../types/domain';
import { parseTicketFile, parseDecisionFile } from '../core/parser';

export class FileConflictError extends Error {
  constructor(filename: string) {
    super(
      `Conflict detected in "${filename}": the file was modified externally since last read. Reload the project before saving.`
    );
    this.name = 'FileConflictError';
  }
}

export class TicketAlreadyExistsError extends Error {
  constructor(filename: string) {
    super(`A file named "${filename}" already exists in .jiraiya/tickets/. Choose another identifier.`);
    this.name = 'TicketAlreadyExistsError';
  }
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function checkJiraiyaDirectoryExists(
  rootHandle: FileSystemDirectoryHandle
): Promise<boolean> {
  try {
    await rootHandle.getDirectoryHandle('.jiraiya', { create: false });
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') {
      return false;
    }
    throw err;
  }
}

export async function initializeJiraiyaWorkspace(
  rootHandle: FileSystemDirectoryHandle
): Promise<void> {
  const jiraiyaDir = await rootHandle.getDirectoryHandle('.jiraiya', { create: true });
  const ticketsDir = await jiraiyaDir.getDirectoryHandle('tickets', { create: true });
  const decisionsDir = await jiraiyaDir.getDirectoryHandle('decisions', { create: true });
  await jiraiyaDir.getDirectoryHandle('reviews', { create: true });

  const config: ProjectConfig = {
    name: rootHandle.name,
    description: 'Local-first study and engineering workspace powered by Jiraiya.',
    createdAt: new Date().toISOString().split('T')[0],
  };

  await writeTextFile(jiraiyaDir, 'config.json', JSON.stringify(config, null, 2));

  const sampleTicket = `---
id: JIR-101
title: Implement in-memory message queue with concurrency protection
type: lab
status: ready
priority: high
tags: [concurrency, memory-queue, synchronization]
concepts: [Mutex & Locks, Producer-Consumer Pattern, Race Conditions]
dependencies: []
decisions: [ADR-001]
---

## Context and Goals
In a message broker, multiple producers publish events concurrently while consumers compete to read them. The goal of this ticket is to build the core in-memory buffer guaranteeing thread-safety without dropping messages.

## Scope
- Build a thread-safe circular buffer (Ring Buffer) or linked queue.
- Expose \`publish\` and \`poll\` methods.
- Properly block or signal when the queue reaches maximum capacity (basic backpressure).

## Acceptance Criteria
- [ ] Support deterministic FIFO insertion and removal.
- [ ] Reject or await new messages when the buffer reaches maximum capacity.
- [ ] Pass a stress test with multiple concurrent producers without corrupting state.

## Technical Guidelines
- Avoid high-level synchronized wrappers if the lab's goal is to practice core concurrency primitives.
- Minimize lock contention by keeping critical sections as compact as possible.
`;

  const sampleSecondTicket = `---
id: JIR-102
title: Implement Graceful Shutdown mechanism for consumers
type: task
status: in_progress
priority: medium
tags: [lifecycle, fault-tolerance, signals]
concepts: [Graceful Shutdown, In-flight Messages, Idempotency]
dependencies: [JIR-101]
decisions: [ADR-001]
---

## Context and Goals
Abruptly stopping an active consumer can leave messages partially processed or lost. We need to handle termination signals and wait for in-flight tasks to finish.

## Acceptance Criteria
- [x] Capture termination signals (SIGINT / SIGTERM).
- [ ] Stop accepting new messages from the queue immediately upon receiving signal.
- [ ] Await completion of in-flight messages up to a configurable timeout.
`;

  const sampleDecision = `---
id: ADR-001
title: Adoption of Bounded Queue with explicit backpressure
status: accepted
date: ${new Date().toISOString().split('T')[0]}
---

## Context
If producers send messages faster than consumers can drain them, an unbounded in-memory queue will grow indefinitely until the process crashes with Out of Memory (OOM).

## Decision
We will adopt an in-memory queue with strict configurable capacity (Bounded Queue). When full, write operations will return an explicit capacity error or wait for an available slot.

## Alternatives Considered
1. **Unbounded Queue**: Simpler initial implementation, but fragile under traffic spikes.
2. **Silent Drop (Drop Tail)**: Protects memory, but violates delivery reliability without notifying the producer.

## Justification
Enforcing capacity limits teaches one of the most critical patterns in distributed systems: **flow control and backpressure**.

## Consequences
- Producer clients must handle queue-full conditions (e.g. retry with exponential backoff).
- RAM consumption of the broker remains predictable and bounded.
`;

  await Promise.all([
    writeTextFile(ticketsDir, 'JIR-101.md', sampleTicket),
    writeTextFile(ticketsDir, 'JIR-102.md', sampleSecondTicket),
    writeTextFile(decisionsDir, 'ADR-001.md', sampleDecision),
  ]);
}

async function writeTextFile(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
  content: string
): Promise<number> {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
  const updatedFile = await fileHandle.getFile();
  return updatedFile.lastModified;
}

async function readGitBranchIfAvailable(
  rootHandle: FileSystemDirectoryHandle
): Promise<string | undefined> {
  try {
    const gitDir = await rootHandle.getDirectoryHandle('.git', { create: false });
    const headHandle = await gitDir.getFileHandle('HEAD', { create: false });
    const headFile = await headHandle.getFile();
    const rawHead = (await headFile.text()).trim();
    const refMatch = rawHead.match(/^ref:\s*refs\/heads\/(.+)$/);
    if (refMatch) {
      return refMatch[1].trim();
    }
    if (/^[0-9a-f]{7,40}$/i.test(rawHead)) {
      return rawHead.slice(0, 7);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function loadJiraiyaWorkspace(
  rootHandle: FileSystemDirectoryHandle
): Promise<LoadedWorkspace> {
  const jiraiyaDir = await rootHandle.getDirectoryHandle('.jiraiya', { create: false });

  let config: ProjectConfig = {
    name: rootHandle.name,
    createdAt: new Date().toISOString().split('T')[0],
  };

  try {
    const configHandle = await jiraiyaDir.getFileHandle('config.json', { create: false });
    const configFile = await configHandle.getFile();
    const parsed = JSON.parse(await configFile.text()) as Partial<ProjectConfig>;
    if (parsed.name) {
      config = {
        name: parsed.name,
        description: parsed.description,
        createdAt: parsed.createdAt ?? config.createdAt,
      };
    }
  } catch {
    // Se config.json não existir ainda, mantém o nome da pasta como fallback seguro
  }

  const tickets: Ticket[] = [];
  try {
    const ticketsDir = await jiraiyaDir.getDirectoryHandle('tickets', { create: false });
    for await (const entry of ticketsDir.values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.md')) {
        const file = await entry.getFile();
        const text = await file.text();
        tickets.push(parseTicketFile(entry.name, text, file.lastModified));
      }
    }
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'NotFoundError')) {
      throw err;
    }
  }

  const decisions: ArchitectureDecision[] = [];
  try {
    const decisionsDir = await jiraiyaDir.getDirectoryHandle('decisions', { create: false });
    for await (const entry of decisionsDir.values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.md')) {
        const file = await entry.getFile();
        const text = await file.text();
        decisions.push(parseDecisionFile(entry.name, text, file.lastModified));
      }
    }
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'NotFoundError')) {
      throw err;
    }
  }

  const gitBranch = await readGitBranchIfAvailable(rootHandle);

  tickets.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  decisions.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  return { config, tickets, decisions, gitBranch };
}

export async function saveTicketContentSafely(
  rootHandle: FileSystemDirectoryHandle,
  filename: string,
  expectedLastModified: number,
  newContent: string
): Promise<Ticket> {
  const jiraiyaDir = await rootHandle.getDirectoryHandle('.jiraiya', { create: false });
  const ticketsDir = await jiraiyaDir.getDirectoryHandle('tickets', { create: false });
  const fileHandle = await ticketsDir.getFileHandle(filename, { create: false });

  const currentFile = await fileHandle.getFile();
  if (currentFile.lastModified !== expectedLastModified) {
    throw new FileConflictError(filename);
  }

  const writable = await fileHandle.createWritable();
  await writable.write(newContent);
  await writable.close();

  const updatedFile = await fileHandle.getFile();
  return parseTicketFile(filename, newContent, updatedFile.lastModified);
}

export async function createNewTicketSafely(
  rootHandle: FileSystemDirectoryHandle,
  rawId: string,
  content: string
): Promise<Ticket> {
  const safeBase = rawId.trim().replace(/[^a-zA-Z0-9_-]/g, '-').toUpperCase();
  const filename = `${safeBase || `TICKET-${Date.now()}`}.md`;

  const jiraiyaDir = await rootHandle.getDirectoryHandle('.jiraiya', { create: false });
  const ticketsDir = await jiraiyaDir.getDirectoryHandle('tickets', { create: true });

  let exists = false;
  try {
    await ticketsDir.getFileHandle(filename, { create: false });
    exists = true;
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'NotFoundError')) {
      throw err;
    }
  }

  if (exists) {
    throw new TicketAlreadyExistsError(filename);
  }

  const lastModified = await writeTextFile(ticketsDir, filename, content);
  return parseTicketFile(filename, content, lastModified);
}
