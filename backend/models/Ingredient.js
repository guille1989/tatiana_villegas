import mongoose from 'mongoose';

const alternativeSchema = new mongoose.Schema(
  {
    name: String,
    quantity: Number,
    unit: String,
    kcal: Number,
    carbs: Number,
    protein: Number,
    fat: Number,
  },
  { _id: false }
);

const macrosSchema = new mongoose.Schema(
  {
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
  },
  { _id: false }
);

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    portionGrams: { type: Number, default: null },
    kcalApprox: { type: Number, default: null },
    householdMeasure: { type: String, default: null },
    macros: { type: macrosSchema, default: () => ({}) },
  },
  { _id: false }
);

const ingredientSchema = new mongoose.Schema(
  {
    // Legacy per-meal ingredient fields
    meal: { type: mongoose.Schema.Types.ObjectId, ref: 'Meal' },
    name: { type: String },
    quantity: Number,
    unit: String,
    kcal: Number,
    carbs: Number,
    protein: Number,
    fat: Number,
    alternatives: [alternativeSchema],

    // Catalog-style grouped ingredients
    category: { type: String },
    portionLabel: { type: String },
    macrosPerPortion: { type: macrosSchema, default: () => ({}) },
    items: { type: [itemSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Ingredient', ingredientSchema);
