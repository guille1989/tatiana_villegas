import express from 'express';
import auth from '../middleware/authMiddleware.js';
import requireAdmin from '../middleware/requireAdmin.js';
import { getSummary, listUsers, getUserDetail, exportUsersCsv } from '../controllers/adminController.js';

const router = express.Router();

router.use(auth, requireAdmin);

router.get('/dashboard/summary', getSummary);
router.get('/users/export.csv', exportUsersCsv);
router.get('/users', listUsers);
router.get('/users/:id', getUserDetail);

export default router;
