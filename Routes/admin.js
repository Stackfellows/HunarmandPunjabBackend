import express from 'express';
import {
    createEmployee,
    getEmployees,
    updateEmployee,
    assignTask,
    sendEmail,
    getWorkProgress,
    updateWorkProgressStatus,
    downloadWorkProgressPDF
} from '../Controllers/admin.js';
import { protect, admin } from '../middlewares/auth.js';

const router = express.Router();

// Apply protection and admin check to all routes
router.use(protect, admin);

// Admin endpoints for employee management
router.get('/employees', getEmployees);
router.post('/employees', createEmployee);
router.put('/employees/:id', updateEmployee);

// Task and Notification management
router.post('/tasks', assignTask);
router.post('/send-email', sendEmail);

// Work Progress
router.get('/work-progress', getWorkProgress);
router.patch('/work-progress/:id', updateWorkProgressStatus);
router.get('/work-progress/export/:userId', downloadWorkProgressPDF);

export default router;
