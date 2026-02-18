import express from 'express';
const router = express.Router();

import { markAttendance, getAttendanceHistory, getTodayAttendanceAdmin, getEmployeeAttendanceHistory } from '../Controllers/attendance.js';
import { protect, admin } from '../middlewares/auth.js';

router.post('/mark', protect, markAttendance);
router.get('/history', protect, getAttendanceHistory);
router.get('/admin/today', protect, admin, getTodayAttendanceAdmin);
router.get('/admin/stats/:id', protect, admin, getEmployeeAttendanceHistory);

export default router;
