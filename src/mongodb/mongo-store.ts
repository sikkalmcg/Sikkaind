'use client';

// This project uses a Firestore-like client wrapper over MongoDB.
// In this repo, the real implementation lives in `src/lib/mongo-store.ts`.
// However, some imports expect `src/mongodb/mongo-store.ts` to re-export it.
// The file was empty, which breaks proper runtime behavior.

export * from '@/lib/mongo-store';

