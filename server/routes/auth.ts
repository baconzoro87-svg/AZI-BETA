import { Router, Request, Response, NextFunction } from 'express';
import {
  findUserByEmail,
  createUser,
  createSession,
  findSession,
  deleteSession,
  findUserById,
  getDB
} from '../db.js';
import { verifyPassword } from '../crypto.js';
import { User } from '../types.js';

export const authRouter = Router();

// Extend Request to include user
export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionToken?: string;
}

// Middleware: Authenticate Session Token
export function authenticateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-session-token'] as string);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const sessionData = findSession(token);
  if (!sessionData) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  req.user = sessionData.user;
  req.sessionToken = token;
  next();
}

// Middleware: Require Owner Admin
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  authenticateUser(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: Owner / Administrator privilege required.' });
    }
    next();
  });
}

// POST /api/auth/login
authRouter.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (user.suspended) {
    return res.status(403).json({ error: 'This account has been suspended by the administrator.' });
  }

  const isValid = verifyPassword(password, user.passwordHash, user.salt);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const session = createSession(user.id);

  return res.json({
    token: session.token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      requestsToday: user.requestsToday,
      tokensToday: user.tokensToday,
      totalRequests: user.totalRequests,
    },
  });
});

// POST /api/auth/register
authRouter.post('/register', (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const newUser = createUser(email, password, name || email.split('@')[0], 'user');
    const session = createSession(newUser.id);

    return res.json({
      token: session.token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        requestsToday: newUser.requestsToday,
        tokensToday: newUser.tokensToday,
        totalRequests: newUser.totalRequests,
      },
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/auth/me
authRouter.get('/me', authenticateUser, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  return res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    requestsToday: user.requestsToday,
    tokensToday: user.tokensToday,
    totalRequests: user.totalRequests,
  });
});

// POST /api/auth/logout
authRouter.post('/logout', authenticateUser, (req: AuthenticatedRequest, res: Response) => {
  if (req.sessionToken) {
    deleteSession(req.sessionToken);
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// POST /api/auth/quick-switch (Convenient persona switch for testing/demo)
authRouter.post('/quick-switch', (req: Request, res: Response) => {
  const { role } = req.body; // 'admin' | 'user'
  const current = getDB();
  const targetUser = current.users.find(u => u.role === role);

  if (!targetUser) {
    return res.status(404).json({ error: `No demo user found for role ${role}` });
  }

  const session = createSession(targetUser.id);
  return res.json({
    token: session.token,
    user: {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      role: targetUser.role,
      requestsToday: targetUser.requestsToday,
      tokensToday: targetUser.tokensToday,
      totalRequests: targetUser.totalRequests,
    },
  });
});
