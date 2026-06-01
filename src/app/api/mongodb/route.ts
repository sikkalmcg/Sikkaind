import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getMongoDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

type Constraint = {
  kind: 'where';
  field: string;
  op: string;
  value: any;
};

function splitDocumentPath(path: string) {
  const parts = path.split('/').filter(Boolean);
  const id = parts.pop();
  if (!id || parts.length === 0) {
    throw new Error(`Invalid document path: ${path}`);
  }
  return { collectionPath: parts.join('/'), id };
}

function collectionName(path: string) {
  return path.replace(/[^a-zA-Z0-9_]+/g, '__');
}

function serializeData(value: any): any {
  if (Array.isArray(value)) {
    return value.map(serializeData);
  }

  if (value && typeof value === 'object') {
    if (value.__mongoServerTimestamp) {
      const now = Date.now();
      return {
        seconds: Math.floor(now / 1000),
        nanoseconds: (now % 1000) * 1_000_000,
      };
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, serializeData(nestedValue)]),
    );
  }

  return value;
}

function toClientDocument(document: any) {
  if (!document) return null;
  const { _id, ...data } = document;
  return { id: String(_id), ...data };
}

function buildFilter(constraints: Constraint[] = []) {
  const filter: Record<string, any> = {};

  for (const constraint of constraints || []) {
    if (constraint.kind !== 'where') continue;
    if (constraint.op !== '==') {
      throw new Error(`Unsupported query operator: ${constraint.op}`);
    }
    filter[constraint.field] = constraint.value;
  }

  return filter;
}

function isReadOperation(operation: string) {
  return operation === 'list' || operation === 'get';
}

function isSignedIn(request: Request) {
  const authHeader = request.headers.get('authorization');
  return !!authHeader?.startsWith('Bearer ');
}

function canAccess(path: string, operation: string, signedIn: boolean) {
  const read = isReadOperation(operation);

  if (path.startsWith('users/Sikkaind/')) {
    if (read) return true;
    return signedIn;
  }

  if (path.startsWith('public_trips/') || path.startsWith('public_orders/')) {
    if (read) return true;
    return signedIn;
  }

  if (path.startsWith('user_profiles/') || path.startsWith('user_registry/')) {
    return signedIn;
  }

  if (path.startsWith('users/')) {
    const userId = path.split('/')[1];
    return userId !== 'Sikkaind' && signedIn;
  }

  return signedIn;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!canAccess(body.path, body.operation, isSignedIn(request))) {
      return NextResponse.json({ error: 'Permission denied.' }, { status: 403 });
    }

    const db = await getMongoDb();

    if (body.operation === 'list') {
      const docs = await db
        .collection<any>(collectionName(body.path))
        .find(buildFilter(body.constraints))
        .toArray();

      return NextResponse.json({ data: docs.map(toClientDocument) });
    }

    if (body.operation === 'get') {
      const { collectionPath, id } = splitDocumentPath(body.path);
      const document = await db.collection<any>(collectionName(collectionPath)).findOne({ _id: id });
      return NextResponse.json({ data: toClientDocument(document) });
    }

    if (body.operation === 'set') {
      const { collectionPath, id } = splitDocumentPath(body.path);
      const data = serializeData(body.data);
      const collection = db.collection<any>(collectionName(collectionPath));

      if (body.merge) {
        await collection.updateOne({ _id: id }, { $set: data }, { upsert: true });
      } else {
        await collection.replaceOne({ _id: id }, { _id: id, ...data }, { upsert: true });
      }

      return NextResponse.json({ ok: true });
    }

    if (body.operation === 'add') {
      const id = randomUUID();
      await db.collection<any>(collectionName(body.path)).insertOne({ _id: id, ...serializeData(body.data) });
      return NextResponse.json({ id });
    }

    if (body.operation === 'update') {
      const { collectionPath, id } = splitDocumentPath(body.path);
      await db
        .collection<any>(collectionName(collectionPath))
        .updateOne({ _id: id }, { $set: serializeData(body.data) }, { upsert: false });
      return NextResponse.json({ ok: true });
    }

    if (body.operation === 'delete') {
      const { collectionPath, id } = splitDocumentPath(body.path);
      await db.collection<any>(collectionName(collectionPath)).deleteOne({ _id: id });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unsupported operation.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'MongoDB request failed.' }, { status: 500 });
  }
}
