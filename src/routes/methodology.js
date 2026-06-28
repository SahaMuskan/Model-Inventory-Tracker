// API route exposing the risk-scoring scheme (factors, weights, tiers, intervals).
// Used by the on-screen Methodology page and by the live tier-preview in the
// add/edit model form, so the explanation always matches the live calculation.
import express from 'express';
import { load } from '../db.js';
import { getMethodology } from '../riskEngine.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json(getMethodology(load().settings));
});

export default router;
