import express from 'express';
import Meal from '../models/Meal.js';
import Ingredient from '../models/Ingredient.js';
import auth from '../middleware/authMiddleware.js';

const router = express.Router();

const computeTotals = (ingredients) => {
  return ingredients.reduce(
    (acc, ing) => {
      acc.kcal += ing.kcal || 0;
      acc.carbs += ing.carbs || 0;
      acc.protein += ing.protein || 0;
      acc.fat += ing.fat || 0;
      return acc;
    },
    { kcal: 0, carbs: 0, protein: 0, fat: 0 }
  );
};

const computePlanTotals = (dayPlan = {}) => {
  const totals = { kcal: 0, carbs: 0, protein: 0, fat: 0 };
  const zones = Object.values(dayPlan || {});
  zones.forEach((zone) => {
    (zone || []).forEach((entry) => {
      const count = entry?.count || 1;
      if (entry?.type === 'meal') {
        const m = entry.payload?.totals || {};
        totals.kcal += (m.kcal || 0) * count;
        totals.carbs += (m.carbs || 0) * count;
        totals.protein += (m.protein || 0) * count;
        totals.fat += (m.fat || 0) * count;
      } else if (entry?.type === 'ingredient') {
        const macros = entry.payload?.macros || {};
        const kcal =
          entry.payload?.kcal ||
          Math.round((macros.protein || 0) * 4 + (macros.carbs || 0) * 4 + (macros.fat || 0) * 9);
        totals.kcal += kcal * count;
        totals.carbs += (macros.carbs || 0) * count;
        totals.protein += (macros.protein || 0) * count;
        totals.fat += (macros.fat || 0) * count;
      }
    });
  });
  return totals;
};

router.get('/', auth, async (req, res) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.planId) filter.plan = req.query.planId;
    const meals = await Meal.find(filter).populate('restrictionsApplied restrictionsViolated').lean();
    return res.json(meals);
  } catch (err) {
    return res.status(500).json({ message: 'Error listando comidas' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const {
      planId,
      type,
      name,
      ingredients = [],
      restrictionsApplied = [],
      restrictionsViolated = [],
      blockedFoods = [],
    } = req.body;
    const meal = await Meal.create({
      user: req.user._id,
      plan: planId,
      type,
      name,
      totals: { kcal: 0, carbs: 0, protein: 0, fat: 0 },
      restrictionsApplied,
      restrictionsViolated,
      blockedFoods,
    });
    const createdIngredients = await Ingredient.insertMany(
      ingredients.map((ing) => ({ ...ing, meal: meal._id }))
    );
    const totals = computeTotals(createdIngredients);
    meal.totals = totals;
    await meal.save();
    return res.status(201).json({ ...meal.toObject(), ingredients: createdIngredients });
  } catch (err) {
    return res.status(500).json({ message: 'Error creando comida' });
  }
});

router.post('/template', auth, async (req, res) => {
  try {
    const { menuDays = 5, dayPlan = [], locked = false, checklist = {}, checklistHistory = [] } = req.body || {};
    const existing = await Meal.findOne({ user: req.user._id, type: 'template', isBaseTemplate: true });
    const nextStartDay = checklist.startDay !== undefined ? checklist.startDay : existing?.checklist?.startDay || '';
    const planTotalsCurrent = computePlanTotals(existing?.templateDayPlan || dayPlan || {});
    const normalizedHistory = Array.isArray(checklistHistory)
      ? checklistHistory.map((entry) => {
          const planMacros = {
            kcal: Number(entry.planMacros?.kcal) || planTotalsCurrent.kcal || 0,
            carbs: Number(entry.planMacros?.carbs) || planTotalsCurrent.carbs || 0,
            protein: Number(entry.planMacros?.protein) || planTotalsCurrent.protein || 0,
            fat: Number(entry.planMacros?.fat) || planTotalsCurrent.fat || 0,
          };
          const weeklyKcal =
            Number(entry.weeklyKcal) > 0
              ? Number(entry.weeklyKcal)
              : planMacros.kcal > 0
                ? planMacros.kcal * 7
                : 0;
          return {
            startDay: entry.startDay || nextStartDay || '',
            statuses: Array.isArray(entry.statuses) ? entry.statuses : [],
            weights: Array.isArray(entry.weights) ? entry.weights : [],
            weeklyKcal,
            planMacros,
            completedAt: entry.completedAt ? new Date(entry.completedAt) : new Date(),
          };
        })
      : Array.isArray(existing?.checklistHistory)
        ? existing.checklistHistory
        : [];

    // build plan history preserving versiones previas
    const planHistory = Array.isArray(existing?.planHistory) ? [...existing.planHistory] : [];
    const hasPrevPlan = existing?.templateDayPlan && Object.keys(existing.templateDayPlan || {}).length > 0;
    const serialize = (plan) => JSON.stringify(plan || {});
    const existingPlanStr = serialize(existing?.templateDayPlan);
    const newPlanStr = serialize(dayPlan);
    const lastSnapshot = planHistory.length > 0 ? planHistory[planHistory.length - 1] : null;
    const lastSnapshotStr = lastSnapshot ? serialize(lastSnapshot.dayPlan) : null;
    const isPlanChanged = hasPrevPlan && existingPlanStr !== newPlanStr;
    const alreadyCaptured = lastSnapshotStr === existingPlanStr || lastSnapshotStr === newPlanStr;
    const tooRecent =
      lastSnapshot?.savedAt && Date.now() - new Date(lastSnapshot.savedAt).getTime() < 2000;
    if (isPlanChanged && !alreadyCaptured && !tooRecent) {
      planHistory.push({
        dayPlan: existing.templateDayPlan,
        menuDays: existing.menuDays || menuDays,
        macros: computePlanTotals(existing.templateDayPlan || {}),
        savedAt: new Date(),
      });
    }

    const template = await Meal.findOneAndUpdate(
      { user: req.user._id, type: 'template', isBaseTemplate: true },
      {
        user: req.user._id,
        type: 'template',
        isBaseTemplate: true,
        menuDays,
        templateDayPlan: dayPlan,
        planHistory,
        locked,
        checklist: {
          startDay: nextStartDay,
          statuses: Array.isArray(checklist.statuses) ? checklist.statuses : [],
          weights: Array.isArray(checklist.weights) ? checklist.weights : [],
          lastUpdated: new Date(),
        },
        checklistHistory: normalizedHistory,
      },
      { new: true, upsert: true }
    );
    return res.json(template);
  } catch (err) {
    return res.status(500).json({ message: 'Error guardando dia base' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const meal = await Meal.findOne({ _id: req.params.id, user: req.user._id }).populate('restrictionsApplied restrictionsViolated');
    if (!meal) return res.status(404).json({ message: 'Comida no encontrada' });
    const ingredients = await Ingredient.find({ meal: meal._id });
    return res.json({ ...meal.toObject(), ingredients });
  } catch (err) {
    return res.status(500).json({ message: 'Error obteniendo comida' });
  }
});

router.put('/:id/ingredients', auth, async (req, res) => {
  try {
    const { ingredients = [] } = req.body;
    const meal = await Meal.findOne({ _id: req.params.id, user: req.user._id });
    if (!meal) return res.status(404).json({ message: 'Comida no encontrada' });

    await Ingredient.deleteMany({ meal: meal._id });
    const newIngredients = await Ingredient.insertMany(
      ingredients.map((ing) => ({ ...ing, meal: meal._id }))
    );
    const totals = computeTotals(newIngredients);
    meal.totals = totals;
    await meal.save();
    return res.json({ ...meal.toObject(), ingredients: newIngredients });
  } catch (err) {
    return res.status(500).json({ message: 'Error actualizando ingredientes' });
  }
});

export default router;
