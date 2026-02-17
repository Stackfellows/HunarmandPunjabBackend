import express from 'express';
import {
    createEmployee,
    getEmployees,
    updateEmployee,
    assignTask,
    sendBroadcast,
    getWorkProgress,
    updateWorkProgressStatus,
    downloadWorkProgressPDF
} from '../Controllers/admin.js';
import { protect, admin } from '../middlewares/auth.js';

const router = express.Router();

// Admin endpoints for employee management
router.get('/employees', getEmployees);
router.post('/employees', createEmployee);
router.put('/employees/:id', updateEmployee);

// Task and Notification management
router.post('/tasks', assignTask);
router.post('/broadcast', sendBroadcast);

// Work Progress
router.get('/work-progress', getWorkProgress);
router.patch('/work-progress/:id', updateWorkProgressStatus);
router.get('/work-progress/export/:userId', downloadWorkProgressPDF);

export default router;
