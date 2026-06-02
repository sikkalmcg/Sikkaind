import { MongoClient } from 'mongodb';

// 1. Pehle aapki di hui local connection string ko strict default banaya hai
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sikkaind_db';

// 2. Sahi connection pooling lagayi hai taaki socket limits crash na ho
const options = {
  maxPoolSize: 10,             // Ek baar mein max 10 connections hi banenge
  serverSelectionTimeoutMS: 5000, // Agar 5 sec mein connect na ho toh smooth error de, crash na ho
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

const globalForMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

if (process.env.NODE_ENV === 'development') {
  if (!globalForMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalForMongo._mongoClientPromise = client.connect().catch(err => {
      console.error("❌ MongoDB connection failed during development setup:", err);
      throw err;
    });
  }
  clientPromise = globalForMongo._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export async function getMongoDb() {
  try {
    const connectedClient = await clientPromise;
    // 3. Aapke local Compass wale sahi database name 'sikkaind_db' ko default banaya hai
    const dbName = process.env.MONGODB_DB || 'sikkaind_db';
    return connectedClient.db(dbName);
  } catch (error) {
    console.error("❌ getMongoDb runtime error:", error);
    throw new Error("Database connection could not be established.");
  }
}