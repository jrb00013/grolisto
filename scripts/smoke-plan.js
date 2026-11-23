import { allocatePlan } from '../src/services/planner/allocate.js';

const storeId = process.env.SMOKE_STORE_ID || 'store_tj_chelsea';
const out = await allocatePlan({
  budget: Number(process.env.SMOKE_BUDGET || 80),
  days: 2,
  meals: ['lunch', 'dinner'],
  likes: ['chicken'],
  storeId,
  zip: process.env.SCOTR_DEFAULT_ZIP,
  userId: 'smoke-cli',
});
console.log(JSON.stringify(out.plan.totals, null, 2));
