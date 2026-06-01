// 1. Database select karein
use('sikkaind_db');

// 2. Data insert karein 
db.getCollection('users_data').insertMany([
  {
    "status": "backup_loaded",
    "folder": "2026-06-01T09:32:36_75342"
  }
]);

// 3. Database ka data screen par lekar aayein
db.getCollection('users_data').find({});