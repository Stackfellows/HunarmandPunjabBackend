import express from 'express';
import { generatePDF, sendEmail } from '../Controllers/officeDocument.js';
import { protect, admin } from '../middlewares/auth.js';

const router = express.Router();

router.post('/generate-pdf', protect, admin, generatePDF);
router.post('/send-email', protect, admin, sendEmail);

export default router;
