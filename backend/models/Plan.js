import mongoose from 'mongoose';

export const DEFAULT_MEAL_PORTIONS = [
  { key: 'breakfast', label: 'Desayuno', portions: 0, leanProtein: 0, fattyProtein: 0, carbs: 0, fats: 0 },
  { key: 'mid_morning', label: 'Media Manana', portions: 0, leanProtein: 0, fattyProtein: 0, carbs: 0, fats: 0 },
  { key: 'lunch', label: 'Comida', portions: 0, leanProtein: 0, fattyProtein: 0, carbs: 0, fats: 0 },
  { key: 'snack', label: 'Merienda', portions: 0, leanProtein: 0, fattyProtein: 0, carbs: 0, fats: 0 },
  { key: 'dinner', label: 'Cena', portions: 0, leanProtein: 0, fattyProtein: 0, carbs: 0, fats: 0 },
];

const planSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kcal: { type: Number, required: true },
    carbs: { type: Number, required: true },
    protein: { type: Number, required: true },
    fat: { type: Number, required: true },
    bmrMifflin: { type: Number, default: 0 },
    bmrHarrisBenedict: { type: Number, default: 0 },
    bmrAverage: { type: Number, default: 0 },
    activityAdjustedKcal: { type: Number, default: 0 },
    thermogenesisKcal: { type: Number, default: 0 },
    finalPlanKcal: { type: Number, default: 0 },
    mealPortions: {
      type: [
        {
          key: { type: String, required: true },
          label: { type: String, required: true },
          portions: { type: Number, min: 0, default: 1 },
          leanProtein: { type: Number, min: 0, default: 0 },
          fattyProtein: { type: Number, min: 0, default: 0 },
          carbs: { type: Number, min: 0, default: 0 },
          fats: { type: Number, min: 0, default: 0 },
        },
      ],
      default: () => DEFAULT_MEAL_PORTIONS.map((portion) => ({ ...portion })),
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

planSchema.index({ user: 1 }, { unique: true });

export default mongoose.model('Plan', planSchema);
