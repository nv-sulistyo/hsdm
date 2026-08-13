import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function loadJwtSecret(): string {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  // Persist a randomly generated secret so sessions survive restarts
  // without shipping a publicly-known fallback key.
  const secretFile = path.resolve(process.cwd(), 'database', '.jwt_secret');
  try {
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, 'utf8').trim();
      if (existing) return existing;
    }
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, secret, { mode: 0o600 });
    return secret;
  } catch {
    // Last resort: random per-process secret (invalidates tokens on restart).
    return crypto.randomBytes(32).toString('hex');
  }
}

const JWT_SECRET = loadJwtSecret();

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
  };
}

export function generateToken(user: { id: number; username: string; role: string }) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = '';

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session token. Please log in again.' });
  }
}
