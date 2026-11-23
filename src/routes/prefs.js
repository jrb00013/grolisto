import { Router } from 'express';
import { loadPrefs, savePrefs } from '../services/prefs/store.js';

const router = Router();

router.get('/:userId', async (req, res, next) => {
  try {
    res.json(await loadPrefs(req.params.userId));
  } catch (err) {
    next(err);
  }
});

router.post('/:userId', async (req, res, next) => {
  try {
    const current = await loadPrefs(req.params.userId);
    const body = req.body || {};
    const merged = {
      ...current,
      ...body,
      likes: body.likes ?? current.likes,
      allergies: body.allergies ?? current.allergies,
      dislikes: body.dislikes ?? current.dislikes,
      taste: body.taste ?? current.taste,
    };
    res.json(await savePrefs(req.params.userId, merged));
  } catch (err) {
    next(err);
  }
});

export default router;
