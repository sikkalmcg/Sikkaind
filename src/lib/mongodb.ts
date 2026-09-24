import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  var _mongoClientUri: string | undefined;
}

const options = {
  serverSelectionTimeoutMS: 5_000,
  connectTimeoutMS: 5_000,
};

function getClientPromise(): Promise<MongoClient> {
  if (process.env.NODE_ENV === 'development') {
    dotenv.config({ path: '.env.local', override: true });
    dotenv.config({ path: '.env', override: false });
  }

  const uri = process.env.MONGODB_URI?.trim();
  if (!uri || (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://'))) {
    throw new Error('MongoDB is not configured: set a valid MONGODB_URI in .env.local.');
  }

  if (process.env.NODE_ENV === 'development') {
    if (!globalThis._mongoClientPromise || globalThis._mongoClientUri !== uri) {
      const client = new MongoClient(uri, options);
      globalThis._mongoClientUri = uri;
      globalThis._mongoClientPromise = client.connect().catch((err) => {
        globalThis._mongoClientPromise = undefined;
        throw err;
      });
    }
    return globalThis._mongoClientPromise;
  }

  const client = new MongoClient(uri, options);
  return client.connect();
}

/** Returns the database configured by MONGODB_DB (or the URI's default database). */
export const connectDB = async () => {
  const databaseName = process.env.MONGODB_DB?.trim() || 'sikkaind';
  const client = await getClientPromise();
  return client.db(databaseName);
};
