import express from 'express';
const router = express.Router();
import { getEmployeeDashboard, getEmployeeProfile, submitWorkProgress, updateTaskStatus } from '../Controllers/employee.js';
import { protect } from '../middlewares/auth.js';

// Employee endpoints
router.get('/dashboard', protect, getEmployeeDashboard);
router.get('/profile', protect, getEmployeeProfile);
router.post('/work-progress', protect, submitWorkProgress);
router.patch('/tasks/:id', protect, updateTaskStatus);

export default router;
