import { getDb } from '$lib/server/db';
import { initSchema } from '$lib/server/schema';
import fs from 'fs';

fs.mkdirSync('data', { recursive: true });
fs.mkdirSync('storage', { recursive: true });

const db = getDb();
initSchema(db);
