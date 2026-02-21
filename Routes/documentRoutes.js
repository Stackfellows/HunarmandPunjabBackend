import express from 'express';
import { generateDocumentPDF, sendDocumentEmail, getDocumentsHistory } from '../Controllers/documentController.js';
import { protect, admin } from '../middlewares/auth.js';

const router = express.Router();

router.post('/generate', protect, admin, generateDocumentPDF);
router.post('/send', protect, admin, sendDocumentEmail);
router.get('/', protect, admin, getDocumentsHistory);

export default router;
