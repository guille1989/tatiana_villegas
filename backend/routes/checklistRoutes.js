import express from 'express';
import ChecklistItem from '../models/ChecklistItem.js';
import auth from '../middleware/authMiddleware.js';

const router = express.Router();

const normalizeDate = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  const clean = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return clean;
};

router.get('/', auth, async (req, res) => {
  try {
    const targetDate = normalizeDate(req.query.date);
    const items = await ChecklistItem.find({ user: req.user._id, date: targetDate }).populate('meal');
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ message: 'Error obteniendo checklist' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { date, mealId, status } = req.body;
    const targetDate = normalizeDate(date);
    const item = await ChecklistItem.findOneAndUpdate(
      { user: req.user._id, date: targetDate, meal: mealId },
      { status },
      { new: true, upsert: true }
    );
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ message: 'Error guardando checklist' });
  }
});

export default router;
