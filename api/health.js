import { initDatabase, db } from '../backend/database/init.js';

let initialized = false;

export default async function handler(req, res) {
  if (!initialized) {
    try {
      await initDatabase();
      initialized = true;
    } catch (error) {
      return res.status(500).json({ status: 'ERROR', error: error.message });
    }
  }
  
  res.json({ status: 'OK', message: 'API is running' });
}

