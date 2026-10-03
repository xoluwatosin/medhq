// What an assessor writes is kept on the device first.
//
// A visit happens in somebody's home, often with no signal. Every answer is an
// append-only event with an identifier the device generates, held in IndexedDB
// until the server acknowledges it. Nothing is ever dropped because a request
// started, and the same queue replayed twice changes nothing on the server
// because the server stores each identifier once.
//
// Two rules govern everything here.
//
//   Provenance is complete or the row is not ours. A row is only read, shown
//   or sent when the person, the visit, the client and the clinical document
//   all match exactly. A row that cannot say which document it belongs to is
//   never adopted into one; it is kept, counted and reported, not guessed at.
//
//   Order is the order it was written in. Every event carries a per-device
//   sequence, so two edits to the same field replay in the order the assessor
//   made them even when two clocks disagree.
//
// The whole visit is held here too, not only the answers: who is being seen,
// where, what the family already told us and the questions those answers
// belong to. A reload in a house with no signal reopens the visit in full.
//
// Clinical content never touches localStorage.

const DB_NAME = "medic-connect-care";
const DB_VERSION = 3;
const EVENTS = "assessment_events";
const SNAPSHOTS = "assessment_snapshots";
const SUBMISSIONS = "assessment_submissions";

/** Who is writing, and exactly which record they are writing about. */
export interface OfflineScope {
  /** The signed-in professional. Nothing is readable across two of these. */
  ownerId: string;
  assessmentId: string;
  clientId: string;
  /** The clinical document the writing lands in. Required: no document, no writing. */
  documentId: string;
}

export interface CaptureEvent {
  client_event_id: string;
  owner_id: string;
  assessment_id: string;
  client_id: string | null;
  document_id: string | null;
  scope_key: string;
  field_id: string;
  value: unknown;
  captured_at: string;
  /** Monotonic on this device, so replay order is the order of writing. */
  client_seq: number;
  /** pending until the server has acknowledged it. */
  state: "pending" | "sent";
}

/** Everything needed to reopen the visit with no signal at all. */
export interface WorkspaceSnapshot<TBrief = unknown> {
  scope_key: string;
  owner_id: string;
  assessment_id: string;
  client_id: string;
  document_id: string;
  /** The exact returned pre-assessment this visit carries. */
  source_document_id: string | null;
  /** The visit as the server last described it: client, appointment, questions. */
  brief: TBrief;
  responses: Record<string, unknown>;
  /** When the server last told us what it holds. */
  fetched_at: string;
}

/** An assessor pressing Complete while offline. The intent outlives a reload. */
export interface SubmissionIntent {
  scope_key: string;
  owner_id: string;
  assessment_id: string;
  client_id: string;
  document_id: string;
  requested_at: string;
  state: "queued" | "sent";
  last_error: string | null;
}

const supported = () => typeof indexedDB !== "undefined";

export const scopeKey = (scope: OfflineScope) =>
  `${scope.ownerId}::${scope.assessmentId}::${scope.documentId}`;

/**
 * A row belongs to this scope only when every part of its provenance is
 * present and matches. Missing provenance is never filled in from context.
 */
const belongs = (
  scope: OfflineScope,
  row: {
    owner_id?: string;
    assessment_id?: string;
    client_id?: string | null;
    document_id?: string | null;
  } | null | undefined,
): boolean => {
  if (!row) return false;
  return (
    row.owner_id === scope.ownerId &&
    row.assessment_id === scope.assessmentId &&
    row.client_id === scope.clientId &&
    row.document_id === scope.documentId
  );
};

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (!supported()) return Promise.reject(new Error("This device cannot store work offline"));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction!;
      const from = event.oldVersion;

      // Version 1 kept snapshots under the assessment alone, with no owner on
      // any row. That work cannot be attributed to a professional now, so it
      // is never handed to whoever happens to be signed in: the old stores go.
      if (from > 0 && from < 2) {
        for (const name of [EVENTS, SNAPSHOTS, SUBMISSIONS]) {
          if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
        }
      }

      // Version 2 onwards is kept. Some version 2 rows cannot say which
      // clinical document they belong to; those rows are never read into a
      // document, but they are not destroyed either. They are counted and
      // reported instead, so nobody's writing disappears without being told.

      if (!db.objectStoreNames.contains(EVENTS)) {
        db.createObjectStore(EVENTS, { keyPath: "client_event_id" });
      }
      const events = tx.objectStore(EVENTS);
      if (!events.indexNames.contains("scope")) events.createIndex("scope", "scope_key", { unique: false });
      if (!events.indexNames.contains("owner")) events.createIndex("owner", "owner_id", { unique: false });

      if (!db.objectStoreNames.contains(SNAPSHOTS)) {
        db.createObjectStore(SNAPSHOTS, { keyPath: "scope_key" });
      }
      if (!db.objectStoreNames.contains(SUBMISSIONS)) {
        db.createObjectStore(SUBMISSIONS, { keyPath: "scope_key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local storage"));
  });
  return dbPromise;
};

const run = async <T>(
  store: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = work(tx.objectStore(store));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local storage failed"));
  });
};

export const offlineSupported = supported;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** Deterministic order: sequence first, then the clock, then the identifier. */
export const orderEvents = (rows: CaptureEvent[]): CaptureEvent[] =>
  [...rows].sort((a, b) =>
    (a.client_seq ?? 0) - (b.client_seq ?? 0) ||
    a.captured_at.localeCompare(b.captured_at) ||
    a.client_event_id.localeCompare(b.client_event_id));

/** Records one answer locally. The event is the record, not the field. */
export const appendEvent = async (
  scope: OfflineScope,
  fieldId: string,
  value: unknown,
): Promise<CaptureEvent> => {
  const existing = await allEvents(scope);
  const next = existing.reduce((high, row) => Math.max(high, row.client_seq ?? 0), 0) + 1;
  const event: CaptureEvent = {
    client_event_id: newId(),
    owner_id: scope.ownerId,
    assessment_id: scope.assessmentId,
    client_id: scope.clientId,
    document_id: scope.documentId,
    scope_key: scopeKey(scope),
    field_id: fieldId,
    value: value ?? null,
    captured_at: new Date().toISOString(),
    client_seq: next,
    state: "pending",
  };
  await run(EVENTS, "readwrite", (store) => store.put(event));
  return event;
};

export const allEvents = async (scope: OfflineScope): Promise<CaptureEvent[]> => {
  const rows = await run<CaptureEvent[]>(EVENTS, "readonly", (store) =>
    store.index("scope").getAll(scopeKey(scope)) as IDBRequest<CaptureEvent[]>,
  );
  // Belt and braces: the index is scoped, and so is every row handed back.
  return orderEvents(rows.filter((row) => belongs(scope, row)));
};

export const pendingEvents = async (scope: OfflineScope): Promise<CaptureEvent[]> =>
  (await allEvents(scope)).filter((e) => e.state === "pending");

/** Only the server saying it has them moves events out of the queue. */
export const markSent = async (scope: OfflineScope, ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(EVENTS, "readwrite");
    const store = tx.objectStore(EVENTS);
    for (const id of ids) {
      const read = store.get(id);
      read.onsuccess = () => {
        const row = read.result as CaptureEvent | undefined;
        if (belongs(scope, row)) store.put({ ...row!, state: "sent" });
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not update local storage"));
  });
};

/** The whole visit, held so it can be reopened with no signal. */
export const saveSnapshot = async <TBrief>(
  scope: OfflineScope,
  brief: TBrief,
  responses: Record<string, unknown>,
  sourceDocumentId: string | null,
): Promise<void> => {
  const snapshot: WorkspaceSnapshot<TBrief> = {
    scope_key: scopeKey(scope),
    owner_id: scope.ownerId,
    assessment_id: scope.assessmentId,
    client_id: scope.clientId,
    document_id: scope.documentId,
    source_document_id: sourceDocumentId,
    brief,
    responses,
    fetched_at: new Date().toISOString(),
  };
  await run(SNAPSHOTS, "readwrite", (store) => store.put(snapshot));
};

export const readSnapshot = async <TBrief>(
  scope: OfflineScope,
): Promise<WorkspaceSnapshot<TBrief> | null> => {
  const row = await run<WorkspaceSnapshot<TBrief> | undefined>(SNAPSHOTS, "readonly", (store) =>
    store.get(scopeKey(scope)) as IDBRequest<WorkspaceSnapshot<TBrief> | undefined>,
  );
  return belongs(scope, row) ? row! : null;
};

/**
 * The visits this person can reopen on this device with no signal, newest
 * first. Only complete, fully attributed records are offered.
 */
export const heldVisits = async <TBrief>(ownerId: string): Promise<WorkspaceSnapshot<TBrief>[]> => {
  const rows = await run<WorkspaceSnapshot<TBrief>[]>(SNAPSHOTS, "readonly", (store) =>
    store.getAll() as IDBRequest<WorkspaceSnapshot<TBrief>[]>,
  );
  return rows
    .filter((r) => r.owner_id === ownerId && !!r.assessment_id && !!r.client_id && !!r.document_id)
    .sort((a, b) => b.fetched_at.localeCompare(a.fetched_at));
};

/* ---------- the intention to send ---------- */

/**
 * Pressing Complete with no signal is a real decision, so it is written down.
 * It survives a reload and is acted on when there is a connection again.
 */
export const queueSubmission = async (scope: OfflineScope): Promise<void> => {
  const intent: SubmissionIntent = {
    scope_key: scopeKey(scope),
    owner_id: scope.ownerId,
    assessment_id: scope.assessmentId,
    client_id: scope.clientId,
    document_id: scope.documentId,
    requested_at: new Date().toISOString(),
    state: "queued",
    last_error: null,
  };
  await run(SUBMISSIONS, "readwrite", (store) => store.put(intent));
};

export const readSubmission = async (scope: OfflineScope): Promise<SubmissionIntent | null> => {
  const row = await run<SubmissionIntent | undefined>(SUBMISSIONS, "readonly", (store) =>
    store.get(scopeKey(scope)) as IDBRequest<SubmissionIntent | undefined>,
  );
  return belongs(scope, row) ? row! : null;
};

/** A rejected submission stays queued and visible, with what went wrong. */
export const noteSubmissionProblem = async (scope: OfflineScope, message: string): Promise<void> => {
  const current = await readSubmission(scope);
  if (!current) return;
  await run(SUBMISSIONS, "readwrite", (store) => store.put({ ...current, last_error: message }));
};

export const clearSubmission = async (scope: OfflineScope): Promise<void> => {
  const current = await readSubmission(scope);
  if (!current) return;
  await run(SUBMISSIONS, "readwrite", (store) => store.delete(scopeKey(scope)));
};

/** What the assessor should see: the server's answers with local work on top. */
export const mergedResponses = (
  snapshot: { responses?: Record<string, unknown> } | null,
  events: CaptureEvent[],
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...(snapshot?.responses ?? {}) };
  for (const event of orderEvents(events)) out[event.field_id] = event.value;
  return out;
};

/**
 * Everything for one assessment, once it has been sent and acknowledged.
 * Nothing unacknowledged is ever removed: work is only cleared from the device
 * after the server has confirmed it holds it.
 */
export const clearAssessment = async (scope: OfflineScope): Promise<void> => {
  const events = await allEvents(scope);
  if (events.some((e) => e.state === "pending")) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([EVENTS, SNAPSHOTS, SUBMISSIONS], "readwrite");
    const store = tx.objectStore(EVENTS);
    for (const event of events) store.delete(event.client_event_id);
    tx.objectStore(SNAPSHOTS).delete(scopeKey(scope));
    tx.objectStore(SUBMISSIONS).delete(scopeKey(scope));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not clear local storage"));
  });
};

/**
 * Unsent work belonging to somebody else on this device. It is never opened
 * and never sent from this session; it is only counted, so the person who
 * wrote it can be told to sign back in and finish it.
 */
export const otherOwnersPending = async (ownerId: string): Promise<number> => {
  const rows = await run<CaptureEvent[]>(EVENTS, "readonly", (store) =>
    store.getAll() as IDBRequest<CaptureEvent[]>,
  );
  return rows.filter((r) => r.state === "pending" && r.owner_id !== ownerId).length;
};

/**
 * This person's unsent work that cannot say which document it belongs to,
 * written by an older version of the app. It is kept, never filed into a
 * clinical record by guesswork, and reported so it can be dealt with.
 */
export const strandedPending = async (ownerId: string): Promise<number> => {
  const rows = await run<CaptureEvent[]>(EVENTS, "readonly", (store) =>
    store.getAll() as IDBRequest<CaptureEvent[]>,
  );
  return rows.filter(
    (r) => r.state === "pending" && r.owner_id === ownerId && (!r.document_id || !r.client_id),
  ).length;
};
