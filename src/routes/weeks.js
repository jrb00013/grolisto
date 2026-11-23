import { Router } from 'express';
import { loadCurrentWeek, loadWeeks } from '../services/weeks/load.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    res.json({ weeks: await loadWeeks() });
  } catch (err) {
    next(err);
  }
});

router.get('/current', async (_req, res, next) => {
  try {
    res.json({ week: await loadCurrentWeek() });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const weeks = await loadWeeks();
    const week = weeks.find((w) => w.id === req.params.id);
    if (!week) {
      res.status(404).json({ error: 'week not found' });
      return;
    }
    res.json({ week });
  } catch (err) {
    next(err);
  }
});

export default router;
