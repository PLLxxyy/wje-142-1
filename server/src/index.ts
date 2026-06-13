import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import db from './db';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import rectificationRoutes from './routes/rectifications';
import adminRoutes from './routes/admin';
import { authMiddleware } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for uploads
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Save base64 image to file (for photo uploads)
app.post('/api/upload', authMiddleware, (req, res) => {
  const { image, filename } = req.body;

  if (!image) {
    res.status(400).json({ error: '没有图片数据' });
    return;
  }

  // Remove data:image/xxx;base64, prefix
  const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  const ext = filename ? path.extname(filename) : '.jpg';
  const name = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
  const filePath = path.join(uploadsDir, name);

  fs.writeFileSync(filePath, buffer);

  res.json({ url: `/uploads/${name}` });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', authMiddleware, taskRoutes);
app.use('/api/rectifications', authMiddleware, rectificationRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`消防巡检管理平台 - 后端服务启动成功`);
  console.log(`监听端口: ${PORT}`);
  console.log(`API 地址: http://localhost:${PORT}/api`);
});
