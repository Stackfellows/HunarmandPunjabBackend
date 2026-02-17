import express from 'express';
const router = express.Router();
import { getActivityLogs, createActivityLog } from '../Controllers/activityLogController.js';
import { protect, admin } from '../middlewares/auth.js';

router.route('/')
    .get(protect, admin, getActivityLogs)
    .post(protect, admin, createActivityLog);

export default router;
