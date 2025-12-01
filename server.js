// server/server.js
import './config/env.js';
import express from 'express';
import cors from 'cors';
import { connectDb } from './config/db.js';
import { config } from './config/env.js';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import adminRoutes from './routes/admin.js';
import webhookRoutes from './routes/webhooks.js';
import publicRoutes from './routes/public.js';
import { initCronJobs } from './services/scheduler.js';

const app = express();
const allowedOrigins = [
  config.webBaseUrl,
  "https://jpkm-checklist.netlify.app",
  "https://jpkm-checklist.netlify.app/"
];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Task frequency API running');
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/public', publicRoutes);

const start = async () => {
  await connectDb();
  initCronJobs();
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
};

start();
