import { Router } from 'express';
import { createUser, verifyLogin, publicUser, updateProfile, findUserById } from '../services/auth/users.js';
import { signToken } from '../services/auth/tokens.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};
    const user = await createUser({ email, password, name });
    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const user = await verifyLogin(email, password);
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await findUserById(req.userId);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await updateProfile(req.userId, req.body || {});
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
