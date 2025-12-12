import express from 'express';
import auth from '../middleware/authMiddleware.js';
import Ingredient from '../models/Ingredient.js';
import Meal from '../models/Meal.js';

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const meals = await Meal.find({ user: req.user._id }).select('_id');
    const mealIds = meals.map((m) => m._id);
    const namesFromMeals = await Ingredient.distinct('name', mealIds.length ? { meal: { $in: mealIds } } : {});

    const catalogItemNamesAgg = await Ingredient.aggregate([
      { $match: { items: { $exists: true, $ne: [] } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.name' } },
    ]);
    const catalogItemNames = catalogItemNamesAgg.map((n) => n._id).filter(Boolean);

    const names = Array.from(new Set([...namesFromMeals, ...catalogItemNames])).filter(Boolean);
    return res.json(names);
  } catch (err) {
    return res.status(500).json({ message: 'Error obteniendo ingredientes' });
  }
});

router.get('/catalog', auth, async (req, res) => {
  try {
    const catalog = await Ingredient.find({ items: { $exists: true, $ne: [] } }).select(
      'category portionLabel macrosPerPortion items'
    );
    return res.json(catalog);
  } catch (err) {
    return res.status(500).json({ message: 'Error obteniendo catalogo de ingredientes' });
  }
});

export default router;
