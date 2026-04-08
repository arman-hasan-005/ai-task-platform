// MongoDB initialization script
db = db.getSiblingDB('ai_task_platform');

db.createCollection('users');
db.createCollection('tasks');

// Indexes for users
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ createdAt: -1 });

// Indexes for tasks
db.tasks.createIndex({ owner: 1, createdAt: -1 });
db.tasks.createIndex({ status: 1, createdAt: 1 });
db.tasks.createIndex({ owner: 1, status: 1 });
db.tasks.createIndex({ createdAt: -1 });
db.tasks.createIndex({ operation: 1, status: 1 });

print('✅ MongoDB initialized with indexes');
