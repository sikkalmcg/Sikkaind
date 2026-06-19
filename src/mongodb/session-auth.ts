'use client';

export type MongoUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
};

export type MongoAuth = {
  currentUser: MongoUser | null;
  signInAnonymously: () => Promise<MongoUser>;
  signOut: () => Promise<void>;
  onAuthStateChanged: (
    next: (user: MongoUser | null) => void,
    error?: (error: Error) => void,
  ) => () => void;
};

const SESSION_KEY = 'mongo_session_uid';

function readUser(): MongoUser | null {
  if (typeof window === 'undefined') return null;
  const uid = localStorage.getItem(SESSION_KEY);
  return uid ? { uid, displayName: null, email: null } : null;
}

function emitAuthChange() {
  window.dispatchEvent(new Event('mongo-auth-change'));
}

export function createMongoAuth(): MongoAuth {
  return {
    get currentUser() {
      return readUser();
    },

    async signInAnonymously() {
      // If you already have an employee/user record cached (from UI login), reuse it.
      // This avoids generating a random uid that will fail rule checks.
      const existingUser = (() => {
        try {
          const raw = localStorage.getItem('mongo_user_cache');
          if (!raw) return null;
          return JSON.parse(raw);
        } catch {
          return null;
        }
      })();

      const uid = existingUser?.uid || existingUser?.id || readUser()?.uid || crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, uid);
      emitAuthChange();
      return { uid, displayName: null, email: null };
    },


    async signOut() {
      localStorage.removeItem(SESSION_KEY);
      emitAuthChange();
    },

    onAuthStateChanged(next, error) {
      try {
        next(readUser());
      } catch (err: any) {
        error?.(err);
      }

      const handler = () => next(readUser());
      window.addEventListener('mongo-auth-change', handler);
      window.addEventListener('storage', handler);

      return () => {
        window.removeEventListener('mongo-auth-change', handler);
        window.removeEventListener('storage', handler);
      };
    },
  };
}
