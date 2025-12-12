import mongoose from 'mongoose';

const restrictionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    category: {
      type: String,
      enum: ['medical', 'nutritional', 'ethical', 'cultural', 'lifestyle', 'intolerances', 'other'],
      default: 'other',
    },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Restriction', restrictionSchema);
