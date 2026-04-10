import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        code: 401,
        message: '未提供有效的认证令牌',
        data: null
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };

    req.userId = decoded.userId;
    req.userRole = decoded.role;

    next();
  } catch (error) {
    return res.status(401).json({
      code: 401,
      message: '认证令牌无效或已过期',
      data: null
    });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return res.status(401).json({
        code: 401,
        message: '未认证',
        data: null
      });
    }

    if (!roles.includes(req.userRole)) {
      return res.status(403).json({
        code: 403,
        message: '权限不足',
        data: null
      });
    }

    next();
  };
}
