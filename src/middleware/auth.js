import { verifyToken } from '../services/auth/tokens.js';
import { findUserById, publicUser } from '../services/auth/users.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      res.status(401).json({ error: 'login required' });
      return;
    }
    const payload = verifyToken(token);
    const user = await findUserById(payload.sub);
    if (!user) {
      res.status(401).json({ error: 'invalid session' });
      return;
    }
    req.user = publicUser(user);
    req.userId = user.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'invalid or expired token' });
  }
}

export async function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return next();
    const payload = verifyToken(token);
    const user = await findUserById(payload.sub);
    if (user) {
      req.user = publicUser(user);
      req.userId = user.id;
    }
  } catch {
    /* ignore */
  }
  next();
}
