import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db';
import { generateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Login
router.post('/login', (req: AuthRequest, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: '请输入用户名和密码' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as {
    id: number;
    username: string;
    password: string;
    role: string;
    display_name: string;
  } | undefined;

  if (!user) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const isValid = bcrypt.compareSync(password, user.password);
  if (!isValid) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const token = generateToken({
    id: user.id,
    username: user.username,
    role: user.role,
    display_name: user.display_name,
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      display_name: user.display_name,
    },
  });
});

// Get current user info
router.get('/me', (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

// Get all users (for assigning responsible person)
router.get('/users', (req: AuthRequest, res: Response) => {
  const users = db.prepare('SELECT id, username, role, display_name FROM users').all();
  res.json(users);
});

export default router;
