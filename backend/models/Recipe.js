import mongoose from 'mongoose';

const recipeSchema = new mongoose.Schema(
  {
    meal: { type: mongoose.Schema.Types.ObjectId, ref: 'Meal' },
    steps: [{ type: String }],
    notes: String,
  },
  { timestamps: true }
);

export default mongoose.model('Recipe', recipeSchema);
