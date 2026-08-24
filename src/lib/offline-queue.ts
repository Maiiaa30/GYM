"use client";

/**
 * A queue for sets logged without a connection.
 *
 * A gym basement is the normal case, not the exception, so ticking a set never
 * waits on the network: the row is written to IndexedDB first and sent
 * afterwards. Entries survive the phone locking, the tab closing and the app
 * being killed, and are replayed as soon as there is a connection again.
 */

export type PendingSet = {
  setLogId: string;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
  queuedAt: number;
};

const DB_NAME = "gym";
const DB_VERSION = 1;
const STORE = "pending-sets";

/**
 * Only the last state of a set matters: ticking, correcting the repetitions
 * and un-ticking it collapse to whatever it ended up as.
 */
export function mergePending(entries: PendingSet[]): PendingSet[] {
  const latest = new Map<string, PendingSet>();

  for (const entry of entries) {
    const current = latest.get(entry.setLogId);
    if (!current || entry.queuedAt >= current.queuedAt) {
      latest.set(entry.setLogId, entry);
    }
  }

  return [...latest.values()].sort((a, b) => a.queuedAt - b.queuedAt);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "setLogId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transact<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

export async function enqueue(entry: PendingSet): Promise<void> {
  try {
    await transact("readwrite", (store) => store.put(entry));
  } catch {
    // A browser refusing storage still gets the optimistic interface and the
    // direct send below; only the retry is lost.
  }
}

export async function readQueue(): Promise<PendingSet[]> {
  try {
    const entries = await transact<PendingSet[]>("readonly", (store) =>
      store.getAll() as IDBRequest<PendingSet[]>,
    );
    return mergePending(entries ?? []);
  } catch {
    return [];
  }
}

export async function forget(setLogId: string): Promise<void> {
  try {
    await transact("readwrite", (store) => store.delete(setLogId));
  } catch {
    // Nothing to do: a failed delete only means one more replay later.
  }
}

export type Sender = (entry: PendingSet) => Promise<{ ok: boolean }>;

/**
 * Sends everything waiting. Returns how many are still queued afterwards, so
 * the interface can say so. Stops at the first failure: if one send fails the
 * connection is gone and the rest would fail too.
 */
export async function flushQueue(send: Sender): Promise<number> {
  const pending = await readQueue();

  for (const entry of pending) {
    let ok = false;
    try {
      ok = (await send(entry)).ok;
    } catch {
      ok = false;
    }

    if (!ok) break;
    await forget(entry.setLogId);
  }

  return (await readQueue()).length;
}
