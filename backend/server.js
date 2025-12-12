import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import planRoutes from './routes/planRoutes.js';
import mealRoutes from './routes/mealRoutes.js';
import checklistRoutes from './routes/checklistRoutes.js';
import ingredientRoutes from './routes/ingredientRoutes.js';
import restrictionRoutes from './routes/restrictionRoutes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/checklist', checklistRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/restrictions', restrictionRoutes);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('DB connection failed', err);
    process.exit(1);
  });
