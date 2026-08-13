import { MongoClient } from 'mongodb';

declare global {
  var _mongoClientPromise: Promise<MongoClient>;
}

const uri = process.env.MONGODB_URI?.trim();
const databaseName = process.env.MONGODB_DB?.trim() || 'sikkaind';
const options = {
  serverSelectionTimeoutMS: 10_000,
  connectTimeoutMS: 10_000,
};

if (!uri || (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://'))) {
  throw new Error('MongoDB is not configured: set a valid MONGODB_URI in .env.local.');
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  if (!globalThis._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = globalThis._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

/** Returns the database configured by MONGODB_DB (or the URI's default database). */
export const connectDB = async () => (await clientPromise).db(databaseName);
