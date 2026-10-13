import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { initDB } from './server/db.js';
import { authRouter } from './server/routes/auth.js';
import { modelsRouter } from './server/routes/models.js';
import { chatRouter } from './server/routes/chat.js';
import { adminRouter } from './server/routes/admin.js';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function startServer() {
  const app = express();

  // Initialize persistent database
  initDB();

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'AZI — AZMAL INTELLIGENCE Central API',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API routers
  app.use('/api/auth', authRouter);
  app.use('/api/models', modelsRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/admin', adminRouter);

  // Serve static assets or mount Vite dev middleware
  if (!isProduction && fs.existsSync(path.resolve(process.cwd(), 'vite.config.ts'))) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AZI System] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[AZI System] Failed to start server:', err);
  process.exit(1);
});
