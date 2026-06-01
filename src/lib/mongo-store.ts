'use client';

export type DocumentData = Record<string, any>;
export type SetOptions = { merge?: boolean };
export type MongoStoreError = Error;
export type QuerySnapshot<T = DocumentData> = {
  docs: Array<ReturnType<typeof createDocSnapshot>>;
  empty: boolean;
};
export type DocumentSnapshot<T = DocumentData> = ReturnType<typeof createDocSnapshot>;

export type MongoStore = { provider: 'mongodb' };
export type CollectionReference<T = DocumentData> = {
  type: 'collection';
  path: string;
  __memo?: boolean;
};
export type DocumentReference<T = DocumentData> = {
  type: 'document';
  path: string;
  id: string;
  __memo?: boolean;
};
export type WhereConstraint = {
  kind: 'where';
  field: string;
  op: string;
  value: any;
};
export type Query<T = DocumentData> = CollectionReference<T> & {
  constraints: WhereConstraint[];
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    };
  };
};

export function getMongoStore(): MongoStore {
  return { provider: 'mongodb' };
}

function joinPath(parts: unknown[]) {
  return parts.map(String).filter(Boolean).join('/');
}

export function collection(_db: MongoStore, ...pathSegments: string[]): CollectionReference {
  return {
    type: 'collection',
    path: joinPath(pathSegments),
  };
}

export function doc(_db: MongoStore, ...pathSegments: string[]): DocumentReference {
  const path = joinPath(pathSegments);
  const id = path.split('/').pop() || '';
  return {
    type: 'document',
    path,
    id,
  };
}

export function where(field: string, op: string, value: any): WhereConstraint {
  return { kind: 'where', field, op, value };
}

export function query(ref: CollectionReference, ...constraints: WhereConstraint[]): Query {
  return {
    ...ref,
    constraints,
    _query: {
      path: {
        canonicalString: () => ref.path,
        toString: () => ref.path,
      },
    },
  };
}

export function serverTimestamp() {
  return { __mongoServerTimestamp: true };
}

async function request<T>(operation: string, payload: Record<string, any>): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mongo_session_uid') : null;
  const response = await fetch('/api/mongodb', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ operation, ...payload }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `MongoDB operation failed: ${operation}`);
  }

  return response.json();
}

function createDocSnapshot(item: any) {
  return {
    id: item.id,
    exists: () => !!item,
    data: () => {
      const { id, ...data } = item || {};
      return data;
    },
  };
}

export async function getDocs(refOrQuery: CollectionReference | Query) {
  const result = await request<{ data: any[] }>('list', {
    path: refOrQuery.path,
    constraints: 'constraints' in refOrQuery ? refOrQuery.constraints : [],
  });
  const docs = result.data.map(createDocSnapshot);
  return {
    docs,
    empty: docs.length === 0,
  };
}

export async function setDoc(ref: DocumentReference, data: any, options?: SetOptions) {
  await request('set', { path: ref.path, data, merge: !!options?.merge });
}

export async function addDoc(ref: CollectionReference, data: any) {
  const result = await request<{ id: string }>('add', { path: ref.path, data });
  return doc({ provider: 'mongodb' }, ref.path, result.id);
}

export async function updateDoc(ref: DocumentReference, data: any) {
  await request('update', { path: ref.path, data });
}

export async function deleteDoc(ref: DocumentReference) {
  await request('delete', { path: ref.path });
}

export function onSnapshot(
  ref: CollectionReference | Query,
  next: (snapshot: QuerySnapshot) => void,
  error?: (error: Error) => void,
): () => void;
export function onSnapshot(
  ref: DocumentReference,
  next: (snapshot: DocumentSnapshot) => void,
  error?: (error: Error) => void,
): () => void;
export function onSnapshot(
  ref: CollectionReference | Query | DocumentReference,
  next: (snapshot: any) => void,
  error?: (error: Error) => void,
): () => void {
  let active = true;

  const load = async () => {
    try {
      if (ref.type === 'document') {
        const result = await request<{ data: any | null }>('get', { path: ref.path });
        if (active) next(result.data ? createDocSnapshot(result.data) : { id: ref.id, exists: () => false, data: () => undefined });
        return;
      }

      const snapshot = await getDocs(ref);
      if (active) next(snapshot);
    } catch (err: any) {
      if (active) error?.(err);
    }
  };

  load();
  const interval = window.setInterval(load, 5000);
  return () => {
    active = false;
    window.clearInterval(interval);
  };
}

