import { Router } from 'express';
import { allocatePlan } from '../services/planner/allocate.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const result = await allocatePlan(req.body || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
