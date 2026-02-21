import Document from '../Models/Document.js';
import puppeteer from 'puppeteer';
import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to get Letterhead Base64
const getLetterheadBase64 = () => {
    // Correct path based on user's prompt: C:\Users\MFC\OneDrive\Desktop\hun\public\letterhead.jpg
    const letterheadPath = 'C:\\Users\\MFC\\OneDrive\\Desktop\\hun\\public\\letterhead.jpg';
    try {
        if (fs.existsSync(letterheadPath)) {
            const imageBuffer = fs.readFileSync(letterheadPath);
            return `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
        }
        console.warn(`[DocumentController] Letterhead missing at ${letterheadPath}`);
        return null;
    } catch (err) {
        console.error('[DocumentController] Error reading letterhead:', err);
        return null;
    }
};

// @desc    Generate PDF (View/Download)
// @route   POST /api/documents/generate
// @access  Private/Admin
export const generateDocumentPDF = async (req, res) => {
    try {
        const { title, subject, recipientName, content, refNumber } = req.body;
        const letterheadBase64 = getLetterheadBase64();

        const htmlContent = getDocumentHTML(title, subject, recipientName, content, refNumber, letterheadBase64);

        const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': pdfBuffer.length,
            'Content-Disposition': `attachment; filename="${title.replace(/\s+/g, '_')}.pdf"`
        });
        res.send(pdfBuffer);

    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({ success: false, message: 'PDF Generation Failed' });
    }
};

// @desc    Send Document via Email
// @route   POST /api/documents/send
// @access  Private/Admin
export const sendDocumentEmail = async (req, res) => {
    try {
        const { title, subject, recipientName, recipientEmail, content, refNumber, type } = req.body;
        const letterheadBase64 = getLetterheadBase64();

        const htmlContent = getDocumentHTML(title, subject, recipientName, content, refNumber, letterheadBase64);

        // Generate PDF
        const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();

        // Send Email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.ADMIN_EMAIL,
                pass: process.env.ADMIN_PASSWORD
            }
        });

        const mailOptions = {
            from: `Hunarmand Punjab Official <${process.env.ADMIN_EMAIL}>`,
            to: recipientEmail,
            subject: `Official Document: ${subject}`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <p>Dear ${recipientName},</p>
                    <p>Please find the attached official document regarding "<strong>${subject}</strong>".</p>
                    <p>Best Regards,<br><strong>Hunarmand Punjab Administration</strong></p>
                </div>
            `,
            attachments: [
                {
                    filename: `${title.replace(/\s+/g, '_')}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        await transporter.sendMail(mailOptions);

        // Save Record
        const newDoc = await Document.create({
            title,
            subject,
            recipientName,
            recipientEmail,
            content,
            type,
            refNumber,
            createdBy: req.user._id
        });

        res.status(200).json({ success: true, message: 'Document sent successfully', document: newDoc });

    } catch (error) {
        console.error('Email Sending Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Document History
// @route   GET /api/documents
// @access  Private/Admin
export const getDocumentsHistory = async (req, res) => {
    try {
        const docs = await Document.find().sort({ createdAt: -1 });
        res.json({ success: true, documents: docs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Helper HTML Template
const getDocumentHTML = (title, subject, recipientName, content, refNumber, letterheadBase64) => {
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    return `
    <html>
    <head>
        <style>
            @page {
                size: A4;
                margin-top: 25mm; /* Standard margin */
                margin-bottom: 25mm;
                margin-left: 25mm;
                margin-right: 25mm;
            }
            body {
                font-family: 'Times New Roman', serif;
                font-size: 11pt; /* slightly smaller for cleaner look */
                line-height: 1.6;
                color: #000;
                text-align: justify;
                text-justify: inter-word;
            }
            /* Background removed */
            .meta-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
                font-weight: bold;
                font-size: 10pt;
            }
            .content {
                margin-bottom: 40px;
                white-space: pre-wrap;
            }
            p {
                margin-bottom: 1em;
                page-break-inside: avoid;
            }
            .recipient {
                margin-bottom: 30px;
                font-weight: bold;
                line-height: 1.4;
            }
            .signature-section {
                margin-top: 50px;
                float: right;
                text-align: center;
                width: 200px;
            }
            .signature-line {
                border-top: 1px solid #000;
                margin-top: 50px;
                padding-top: 5px;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        
        <div class="meta-info clearfix">
            <div class="ref-no">Ref No: ${refNumber || 'HP/OFF/GEN'}</div>
            <div class="date">Date: ${today}</div>
        </div>

        <div class="recipient">
            To,<br>
            ${recipientName}
        </div>

        <div class="subject">SUBJECT: ${subject}</div>

        <div class="content">
            ${content}
        </div>

        <div class="signature-section">
            <div class="signature-line">
                Danish Manzoor<br>
                CEO, Hunarmand Punjab
            </div>
        </div>
    </body>
    </html>
    `;
};
