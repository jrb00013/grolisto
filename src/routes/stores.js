import { Router } from 'express';
import { findNearbyStores, compareStores } from '../services/scotr/index.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { zip, lat, lng } = req.query;
    const stores = await findNearbyStores({
      zip: zip || undefined,
      lat: lat != null && lat !== '' ? Number(lat) : undefined,
      lng: lng != null && lng !== '' ? Number(lng) : undefined,
    });
    res.json({ stores });
  } catch (err) {
    next(err);
  }
});

router.post('/compare', async (req, res, next) => {
  try {
    const { storeIds, zip, lat, lng, ingredients = [] } = req.body || {};
    let ids = storeIds;
    if (!ids?.length) {
      const nearby = await findNearbyStores({ zip, lat, lng });
      ids = nearby.slice(0, 5).map((s) => s.id);
    }
    const comparisons = await compareStores(ids, ingredients);
    res.json({ comparisons });
  } catch (err) {
    next(err);
  }
});

export default router;
