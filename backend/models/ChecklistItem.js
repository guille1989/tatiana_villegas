import mongoose from 'mongoose';

const checklistItemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    meal: { type: mongoose.Schema.Types.ObjectId, ref: 'Meal', required: true },
    status: { type: String, enum: ['pending', 'done', 'skipped'], default: 'pending' },
  },
  { timestamps: true }
);

checklistItemSchema.index({ user: 1, date: 1, meal: 1 }, { unique: true });

export default mongoose.model('ChecklistItem', checklistItemSchema);
