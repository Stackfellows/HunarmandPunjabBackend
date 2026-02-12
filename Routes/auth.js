import express from 'express';
const router = express.Router();
import { loginUser, getMe } from '../Controllers/auth.js';
import { protect } from '../middlewares/auth.js';

// Auth routes
router.post('/login', loginUser);
router.get('/me', protect, getMe);

export default router;
