import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    age: Number,
    weight: Number,
    height: Number,
    sex: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
    activityLevel: String,
    trainingDays: Number,
    goal: { type: String, enum: ['muscle_gain', 'fat_loss'], default: 'muscle_gain' },
    preferences: {
      prefCarbs: { type: Boolean, default: false },
      prefFats: { type: Boolean, default: false },
      restrictions: { type: String, default: '' },
      notes: { type: String, default: '' },
      blockedFoods: { type: [String], default: [] },
      restrictionsDetail: {
        medical: { type: [String], default: [] },
        nutritional: { type: [String], default: [] },
        ethical: { type: [String], default: [] },
        cultural: { type: [String], default: [] },
        lifestyle: { type: [String], default: [] },
        intolerances: { type: [String], default: [] },
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Profile', profileSchema);
