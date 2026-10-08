import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDatabase, db, closeDatabase } from './database/init.js';
import { createReadinessHandler } from './readiness.js';
import { requireJwtSecret } from './config.js';
import authRoutes from './routes/auth.js';
import orgRoutes from './routes/organizations.js';
import contractRoutes from './routes/contracts.js';
import dashboardRoutes from './routes/dashboard.js';
import versionRoutes from './routes/versions.js';
import aiRoutes from './routes/ai.js';
import ipfsRoutes from './routes/ipfs.js';

const app = express();
const PORT = process.env.PORT || 3001;
requireJwtSecret();

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(origin => origin.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '10mb' }));

// Initialize database
await initDatabase();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', versionRoutes);
app.use('/api', aiRoutes);
app.use('/api', ipfsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API is running' });
});
let shuttingDown = false;
app.get('/api/ready', createReadinessHandler(db, () => shuttingDown));

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const shutdownTimeout = Number(process.env.SHUTDOWN_TIMEOUT_MS);
const gracePeriodMs = Number.isFinite(shutdownTimeout) && shutdownTimeout > 0
  ? shutdownTimeout : 10000;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; draining API requests`);

  const deadline = setTimeout(() => {
    console.error('Shutdown grace period expired; closing active connections');
    server.closeAllConnections?.();
    process.exit(1);
  }, gracePeriodMs);

  server.close(async error => {
    try {
      await closeDatabase();
    } catch (closeError) {
      console.error('Failed to close database:', closeError);
      error ||= closeError;
    } finally {
      clearTimeout(deadline);
    }
    if (error) console.error('Failed to shut down API:', error);
    process.exitCode = error ? 1 : 0;
  });
  server.closeIdleConnections?.();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
