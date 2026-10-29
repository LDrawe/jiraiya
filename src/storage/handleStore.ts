import type { RegisteredProject } from '../types/domain';

const DB_NAME = 'jiraiya_navigation_db';
const STORE_NAME = 'project_handles';
const DB_VERSION = 1;

interface StoredHandleRecord {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  ticketCount?: number;
  doneCount?: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listRegisteredProjects(): Promise<RegisteredProject[]> {
  const db = await openDatabase();
  const records = await new Promise<StoredHandleRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as StoredHandleRecord[]);
    req.onerror = () => reject(req.error);
  });

  const projects: RegisteredProject[] = [];
  for (const rec of records) {
    let permissionState: PermissionState = 'prompt';
    try {
      permissionState = await rec.handle.queryPermission({ mode: 'readwrite' });
    } catch {
      permissionState = 'prompt';
    }
    projects.push({
      id: rec.id,
      name: rec.name,
      handle: rec.handle,
      permissionState,
      ticketCount: rec.ticketCount,
      doneCount: rec.doneCount,
    });
  }
  return projects;
}

export async function saveRegisteredProject(project: RegisteredProject): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record: StoredHandleRecord = {
      id: project.id,
      name: project.name,
      handle: project.handle,
      ticketCount: project.ticketCount,
      doneCount: project.doneCount,
    };
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function removeRegisteredProject(id: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
