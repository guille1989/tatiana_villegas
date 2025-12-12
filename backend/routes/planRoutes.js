import express from "express";
import Plan, { DEFAULT_MEAL_PORTIONS } from "../models/Plan.js";
import Profile from "../models/Profile.js";
import auth from "../middleware/authMiddleware.js";

const router = express.Router();

const ACTIVITY_FACTORS = {
  sedentary: { 3: 1.3, 4: 1.4, 5: 1.5, 6: 1.6 },
  light: { 3: 1.5, 4: 1.6, 5: 1.7, 6: 1.8 },
};

const LEGACY_ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  athlete: 1.9,
};

const ceilOrBase = (value, base) => {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 0) return Math.ceil(num);
  const baseNum = Number(base);
  if (Number.isFinite(baseNum) && baseNum >= 0) return Math.ceil(baseNum);
  return 0;
};

const normalizeMealPortions = (portions = []) => {
  const base = DEFAULT_MEAL_PORTIONS.reduce((acc, portion) => {
    acc[portion.key] = { ...portion };
    return acc;
  }, {});

  portions.forEach((portion) => {
    if (!portion || !portion.key || !base[portion.key]) return;
    const numericPortion = ceilOrBase(portion.portions, base[portion.key].portions);
    const leanProtein = ceilOrBase(portion.leanProtein, base[portion.key].leanProtein);
    const fattyProtein = ceilOrBase(portion.fattyProtein, base[portion.key].fattyProtein);
    const carbs = ceilOrBase(portion.carbs, base[portion.key].carbs);
    const fats = ceilOrBase(portion.fats, base[portion.key].fats);
    base[portion.key] = {
      ...base[portion.key],
      label: portion.label || base[portion.key].label,
      portions: numericPortion,
      leanProtein,
      fattyProtein,
      carbs,
      // Guardamos solo las porciones de grasa extra (la proteina grasa se contabiliza aparte)
      fats,
    };
  });

  return Object.values(base);
};

const calculatePlan = (profile) => {
  console.log("Calculating plan with profile:", profile);
  const {
    age = 30,
    weight = 70,
    height = 170,
    sex = "male",
    activityLevel = "sedentary_3",
    trainingDays = 3,
  } = profile || {};
  const [levelKey, daysFromLevel] = String(activityLevel || "").split("_");
  const parsedDays = Number.isFinite(Number(daysFromLevel))
    ? Number(daysFromLevel)
    : Number(trainingDays);
  const levelFactors = ACTIVITY_FACTORS[levelKey] || ACTIVITY_FACTORS[activityLevel];
  const factorFromTable =
    levelFactors && Number.isFinite(parsedDays) ? levelFactors[parsedDays] : undefined;
  const factor =
    factorFromTable ??
    LEGACY_ACTIVITY_FACTORS[activityLevel] ??
    (ACTIVITY_FACTORS.sedentary ? ACTIVITY_FACTORS.sedentary[3] : 1.3);

  // 1) BMR Mifflin-St Jeor
  const sMifflin = sex === "female" ? -161 : 5;
  const bmrMifflin = 10 * weight + 6.25 * height - 5 * age + sMifflin;

  // 2) BMR Harris-Benedict
  const bmrHarris =
    sex === "female"
      ? 447.593 + 9.247 * weight + 3.098 * height - 4.33 * age
      : 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age;

  // 3) Promedio BMR
  const bmrAverage = (bmrMifflin + bmrHarris) / 2;

  // 4) Aplicar factor de actividad
  const activityAdjustedKcal = bmrAverage * factor;

  // 5) Termogénesis (TEF) multiplicador 1.1
  const thermogenesisKcal = activityAdjustedKcal * 1.1;

  // 6) Déficit 30% (pérdida de grasa)
  const finalPlanKcal = thermogenesisKcal * 0.7;

  const kcal = Math.round(finalPlanKcal);
  const protein = Math.round(weight * 2.2);
  const fat = Math.round(weight * 0.9);
  const carbs = Math.max(0, Math.round((kcal - (protein * 4 + fat * 9)) / 4));

  return {
    kcal,
    carbs,
    protein,
    fat,
    bmrMifflin: Math.round(bmrMifflin),
    bmrHarrisBenedict: Math.round(bmrHarris),
    bmrAverage: Math.round(bmrAverage),
    activityAdjustedKcal: Math.round(activityAdjustedKcal),
    thermogenesisKcal: Math.round(thermogenesisKcal),
    finalPlanKcal: Math.round(finalPlanKcal),
  };
};

router.post("/generate", auth, async (req, res) => {
  try {
    const existingPlan = await Plan.findOne({ user: req.user._id });
    const shouldRecalculate = !!req.body.profile || !existingPlan;
    const profile = shouldRecalculate
      ? req.body.profile ||
        (await Profile.findOne({ user: req.user._id })) ||
        {}
      : null;
    const macros = shouldRecalculate ? calculatePlan(profile) : null;
    const mealPortions = normalizeMealPortions(
      req.body.mealPortions || existingPlan?.mealPortions
    );
    const plan = await Plan.findOneAndUpdate(
      { user: req.user._id },
      { user: req.user._id, ...(macros || {}), mealPortions },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.json(plan);
  } catch (err) {
    return res.status(500).json({ message: "Error generando plan" });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const { kcal, carbs, protein, fat, mealPortions } = req.body;
    const updateData = {};
    if (kcal !== undefined) {
      updateData.kcal = kcal;
      updateData.finalPlanKcal = kcal;
    }
    if (carbs !== undefined) updateData.carbs = carbs;
    if (protein !== undefined) updateData.protein = protein;
    if (fat !== undefined) updateData.fat = fat;
    if (Array.isArray(mealPortions))
      updateData.mealPortions = normalizeMealPortions(mealPortions);

    const plan = await Plan.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updateData,
      { new: true }
    );
    if (!plan) return res.status(404).json({ message: "Plan no encontrado" });
    return res.json(plan);
  } catch (err) {
    return res.status(500).json({ message: "Error actualizando plan" });
  }
});

export default router;
