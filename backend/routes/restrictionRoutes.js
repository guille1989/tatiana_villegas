import express from 'express';
import auth from '../middleware/authMiddleware.js';
import Restriction from '../models/Restriction.js';

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    const restrictions = await Restriction.find(filter).sort({ category: 1, name: 1 }).lean();
    return res.json(restrictions);
  } catch (err) {
    return res.status(500).json({ message: 'Error obteniendo restricciones' });
  }
});

export default router;
