import express from 'express';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './src/server/db.js';

import authRoutes from './src/server/routes/auth.js';
import repositoryRoutes from './src/server/routes/repositories.js';
import deploymentRoutes from './src/server/routes/deployments.js';
import systemRoutes from './src/server/routes/system.js';
import webhookRoutes from './src/server/routes/webhooks.js';
import actionRoutes from './src/server/routes/actions.js';
import dockerRoutes from './src/server/routes/docker.js';
import monitoringRoutes from './src/server/routes/monitoring.js';
import systemdRoutes from './src/server/routes/systemd.js';
import webserverRoutes from './src/server/routes/webserver.js';
import installerRoutes from './src/server/routes/installer.js';

async function startServer() {
  // Initialize SQLite Database schema & default seeds
  initDatabase();

  const app = express();
  const rawPort = parseInt(process.env.PORT || '3000', 10);
  const PORT = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 3000;

  // Middlewares
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use(cookieParser());

  // Capture raw body for GitHub Webhook verification before json middleware
  app.use('/webhooks', express.raw({ type: '*/*', verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
  app.use('/webhooks', (req: any, _res, next) => {
    if (req.rawBody && !req.body) {
      try {
        req.body = JSON.parse(req.rawBody.toString('utf8'));
      } catch {
        req.body = {};
      }
    }
    next();
  });

  // Standard JSON & URL-encoded body parser for API routes
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/repositories', repositoryRoutes);
  app.use('/api/deployments', deploymentRoutes);
  app.use('/api/system', systemRoutes);
  app.use('/api/actions', actionRoutes);
  app.use('/api/docker', dockerRoutes);
  app.use('/api/monitoring', monitoringRoutes);
  app.use('/api/systemd', systemdRoutes);
  app.use('/api/webserver', webserverRoutes);
  app.use('/api/installer', installerRoutes);
  app.use('/webhooks', webhookRoutes);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Home Server Git Automation Manager',
      timestamp: new Date().toISOString()
    });
  });

  // Unknown API routes return JSON 404 instead of falling through to the SPA
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Serve Frontend SPA
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Home Server Git Automation Manager] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
