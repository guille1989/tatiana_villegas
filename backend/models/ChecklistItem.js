import mongoose from 'mongoose';

const checklistItemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    meal: { type: mongoose.Schema.Types.ObjectId, ref: 'Meal' }, // opcional para registros de dia completo
    type: { type: String, enum: ['meal', 'day'], default: 'meal' },
    status: { type: String, enum: ['pending', 'done', 'skipped'], default: 'pending' },
  },
  { timestamps: true }
);

// Un registro por comida en el dia
checklistItemSchema.index(
  { user: 1, date: 1, meal: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: 'meal' } }
);

// Un registro por dia (sin meal)
checklistItemSchema.index(
  { user: 1, date: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: 'day' } }
);

export default mongoose.model('ChecklistItem', checklistItemSchema);
