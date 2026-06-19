import { lookup, setServers } from 'node:dns';
import type { MongoClient } from 'mongodb';

const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  lookup: lookupWithHttpsFallback,
};

const globalForMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

let dnsConfigured = false;
const dnsCache = new Map<string, string>();

function getDatabaseName() {
  return process.env.MONGODB_DB?.trim() || 'sikkaind_db';
}

function configureAtlasDnsFallback(uri: string) {
  if (dnsConfigured || !uri.startsWith('mongodb+srv://')) {
    return;
  }

  const servers = (process.env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);

  if (servers.length > 0) {
    setServers(servers);
  }

  dnsConfigured = true;
}

async function resolveARecordOverHttps(hostname: string) {
  const cachedAddress = dnsCache.get(hostname);
  if (cachedAddress) {
    return cachedAddress;
  }

  const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`, {
    headers: { accept: 'application/dns-json' },
  });

  if (!response.ok) {
    throw new Error(`DNS-over-HTTPS lookup failed for ${hostname}: ${response.status}`);
  }

  const result = await response.json();
  const address = result.Answer?.find((answer: any) => answer.type === 1)?.data;

  if (!address) {
    throw new Error(`DNS-over-HTTPS lookup did not return an A record for ${hostname}.`);
  }

  dnsCache.set(hostname, address);
  return address;
}

function lookupWithHttpsFallback(hostname: string, optionsOrFamily: any, callback: any) {
  lookup(hostname, optionsOrFamily, (error, address, family) => {
    if (!error) {
      callback(null, address, family);
      return;
    }

    resolveARecordOverHttps(hostname)
      .then((resolvedAddress) => {
        if (typeof optionsOrFamily === 'object' && optionsOrFamily?.all) {
          callback(null, [{ address: resolvedAddress, family: 4 }]);
          return;
        }

        callback(null, resolvedAddress, 4);
      })
      .catch(() => callback(error, address, family));
  });
}

function getMongoUriOrThrow() {
  const uri = process.env.MONGODB_URI?.trim();
  const dbName = getDatabaseName();

  if (!uri) {
    throw new Error('MongoDB is not configured: set MONGODB_URI in environment.');
  }

  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error('MongoDB is not configured: MONGODB_URI must start with mongodb:// or mongodb+srv://.');
  }

  configureAtlasDnsFallback(uri);

  if (uri.startsWith('mongodb://')) {
    return uri;
  }

  try {
    const url = new URL(uri);
    if (!url.pathname || url.pathname === '/') {
      url.pathname = `/${dbName}`;
    }
    return url.toString();
  } catch {
    throw new Error('MongoDB is not configured: MONGODB_URI is not a valid connection string.');
  }
}

async function createClientPromise() {
  const uri = getMongoUriOrThrow();
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri, options);

  return client.connect().catch((error) => {
    globalForMongo._mongoClientPromise = undefined;
    throw error;
  });
}

function getClientPromise() {
  if (!globalForMongo._mongoClientPromise) {
    globalForMongo._mongoClientPromise = createClientPromise();
  }

  return globalForMongo._mongoClientPromise;
}

export async function getMongoDb() {
  try {
    const connectedClient = await getClientPromise();
    return connectedClient.db(getDatabaseName());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('MongoDB connection failed:', error);

    if (message.includes('querySrv') || message.includes('ENOTFOUND') || message.includes('ECONNREFUSED')) {
      throw new Error(
        `MongoDB connection failed: Atlas DNS/network lookup failed. Check internet/DNS access and Atlas network access. Details: ${message}`,
      );
    }

    throw new Error(`MongoDB connection failed: ${message}`);
  }
}
