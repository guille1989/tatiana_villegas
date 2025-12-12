import mongoose from 'mongoose';

const mealSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    type: { type: String, default: 'meal' },
    // Slot dentro del dia base (para replicar en 5/15/30 dias)
    slot: { type: String, enum: ['breakfast', 'mid_morning', 'lunch', 'snack', 'dinner', 'other'], default: 'other' },
    // Cantidad de dias para los que se replica este dia base (5, 15, 30)
    menuDays: { type: Number, default: 1 },
    // Si es parte del dia plantilla que se replica
    isBaseTemplate: { type: Boolean, default: false },
    // Estructura del dia base (porciones/platos/ingredientes por tiempo)
    templateDayPlan: { type: mongoose.Schema.Types.Mixed, default: null },
    // Historial de versiones de dia base/platos
    planHistory: [
      {
        dayPlan: { type: mongoose.Schema.Types.Mixed, default: null },
        menuDays: { type: Number, default: 1 },
        macros: {
          kcal: { type: Number, default: 0 },
          carbs: { type: Number, default: 0 },
          protein: { type: Number, default: 0 },
          fat: { type: Number, default: 0 },
        },
        savedAt: { type: Date, default: Date.now },
      },
    ],
    // Estado de bloqueo del plan base
    locked: { type: Boolean, default: false },
    // Checklist de cumplimiento
    checklist: {
      startDay: { type: String, default: '' },
      statuses: { type: [Boolean], default: [] },
      weights: { type: [Number], default: [] },
      lastUpdated: { type: Date, default: null },
    },
    checklistHistory: [
      {
        startDay: { type: String, default: '' },
        statuses: { type: [Boolean], default: [] },
        weights: { type: [Number], default: [] },
        weeklyKcal: { type: Number, default: 0 },
        planMacros: {
          kcal: { type: Number, default: 0 },
          carbs: { type: Number, default: 0 },
          protein: { type: Number, default: 0 },
          fat: { type: Number, default: 0 },
        },
        completedAt: { type: Date, default: Date.now },
      },
    ],
    name: { type: String, required: true },
    totals: {
      kcal: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      protein: { type: Number, default: 0 },
      fat: { type: Number, default: 0 },
    },
    restrictionsApplied: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Restriction', default: [] }],
    restrictionsViolated: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Restriction', default: [] }],
    blockedFoods: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Meal', mealSchema);
