import express from 'express';
const router = express.Router();
import { createEmployee, getEmployees } from '../Controllers/admin.js';

// Admin endpoints for employee management
router.get('/employees', getEmployees);
router.post('/employees', createEmployee);

// Task and Notification management
import { assignTask, sendBroadcast } from '../Controllers/admin.js';
router.post('/tasks', assignTask);
router.post('/broadcast', sendBroadcast);

export default router;
