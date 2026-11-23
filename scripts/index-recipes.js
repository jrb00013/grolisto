import { indexRecipes } from '../src/services/rag/indexRecipes.js';

const result = await indexRecipes();
console.log(JSON.stringify(result, null, 2));
