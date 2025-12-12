import express from 'express';
import Profile from '../models/Profile.js';
import auth from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/me', auth, async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user._id });
    return res.json(profile || {});
  } catch (err) {
    return res.status(500).json({ message: 'Error obteniendo perfil' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const data = req.body || {};
    const updated = await Profile.findOneAndUpdate(
      { user: req.user._id },
      { ...data, user: req.user._id },
      { new: true, upsert: true }
    );
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: 'Error guardando perfil' });
  }
});

export default router;
