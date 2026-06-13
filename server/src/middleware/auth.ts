import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fire-inspection-secret-key-2024';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    display_name: string;
  };
}

export function generateToken(payload: { id: number; username: string; role: string; display_name: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未登录，请先登录' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      username: string;
      role: string;
      display_name: string;
    };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

export function roleGuard(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: '未登录' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: '无权访问' });
      return;
    }
    next();
  };
}
