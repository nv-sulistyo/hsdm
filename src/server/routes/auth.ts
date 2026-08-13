import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { generateToken, requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

// Simple in-memory login rate limiter (10 attempts / 15 min per IP)
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (loginAttempts.size > 10000) {
    for (const [key, entry] of loginAttempts) {
      if (now > entry.resetAt) loginAttempts.delete(key);
    }
  }
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_LOGIN_ATTEMPTS;
}

router.post('/login', (req, res) => {
  const ip = req.ip || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    logAudit({
      username,
      action: 'LOGIN_FAILED',
      ipAddress: req.ip,
      details: 'Invalid password attempt'
    });
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const tokenUser = { id: user.id, username: user.username, role: user.role };
  const token = generateToken(tokenUser);
  loginAttempts.delete(ip);

  res.cookie('token', token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });

  logAudit({
    userId: user.id,
    username: user.username,
    action: 'LOGIN_SUCCESS',
    ipAddress: req.ip,
    details: 'User logged in successfully'
  });

  return res.json({
    message: 'Login successful',
    token,
    user: tokenUser
  });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ message: 'Logged out successfully' });
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  return res.json({ user: req.user });
});

router.post('/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  const now = new Date().toISOString();

  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, now, req.user!.id);

  logAudit({
    userId: req.user!.id,
    username: req.user!.username,
    action: 'CHANGE_PASSWORD',
    ipAddress: req.ip,
    details: 'Password updated successfully'
  });

  return res.json({ message: 'Password updated successfully.' });
});

router.post('/update-account', requireAuth, (req: AuthenticatedRequest, res) => {
  const { currentPassword, newUsername, newPassword } = req.body || {};

  if (!currentPassword) {
    return res.status(400).json({ error: 'Current password is required.' });
  }
  if (!newUsername && !newPassword) {
    return res.status(400).json({ error: 'Provide a new username, a new password, or both.' });
  }

  if (newPassword && newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  if (newUsername !== undefined) {
    const name = String(newUsername).trim();
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(name)) {
      return res.status(400).json({ error: 'Username must be 3-32 characters (letters, numbers, dot, dash, underscore).' });
    }
    if (name !== req.user!.username) {
      const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(name) as any;
      if (exists) {
        return res.status(400).json({ error: 'Username is already taken.' });
      }
    }
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }

  const now = new Date().toISOString();
  const finalUsername = newUsername !== undefined ? String(newUsername).trim() : user.username;
  const finalPasswordHash = newPassword ? bcrypt.hashSync(newPassword, 10) : user.password_hash;

  db.prepare('UPDATE users SET username = ?, password_hash = ?, updated_at = ? WHERE id = ?')
    .run(finalUsername, finalPasswordHash, now, req.user!.id);

  logAudit({
    userId: req.user!.id,
    username: finalUsername,
    action: 'UPDATE_ACCOUNT',
    ipAddress: req.ip,
    details: newPassword
      ? (newUsername !== undefined ? 'Username and password updated' : 'Password updated')
      : 'Username updated'
  });

  const tokenUser = { id: req.user!.id, username: finalUsername, role: user.role };
  const token = generateToken(tokenUser);

  res.cookie('token', token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });

  return res.json({
    message: 'Account updated successfully.',
    token,
    user: tokenUser
  });
});

export default router;
