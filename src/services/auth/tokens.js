import jwt from 'jsonwebtoken';
import { config } from '../../lib/config.js';

export function signToken(user) {
  if (!config.authJwtSecret) throw new Error('AUTH_JWT_SECRET not set');
  return jwt.sign(
    { sub: user.id, email: user.email },
    config.authJwtSecret,
    { expiresIn: config.authJwtTtl || '7d' },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.authJwtSecret);
}
