import Document from '../Models/Document.js';
import puppeteer from 'puppeteer';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Generate PDF Document
// @route   POST /api/office-documents/generate-pdf
// @access  Private/Admin
export const generatePDF = async (req, res) => {
    try {
        const { title, content, type } = req.body;

        // Verify letterhead exists
        // Since backend and frontend are separate, we might need to assume the letterhead is available 
        // to the backend or fetch it. 
        // Ideally, the letterhead image should be base64 encoded by the frontend or available at a public URL.
        // For local development, we can try to access the public folder of the frontend if it's in a known relative path.
        // Or better, we just use a placeholder styling if image is not accessible, 
        // BUT the user said "Use the existing company letterhead located at C:\Users\MFC\OneDrive\Desktop\hun\public\letterhead.jpg"
        // This is a local path on the server (assuming server runs on same machine which it does).

        const letterheadPath = 'C:\\Users\\MFC\\OneDrive\\Desktop\\hun\\public\\letterhead.jpg';
        console.log(`[OfficeDocument] generatePDF: Checking letterhead at: ${letterheadPath}`);

        let letterheadBase64 = '';
        try {
            if (fs.existsSync(letterheadPath)) {
                const imageBuffer = fs.readFileSync(letterheadPath);
                letterheadBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
                console.log('[OfficeDocument] generatePDF: Letterhead loaded successfully.');
            } else {
                console.error(`[OfficeDocument] generatePDF: Letterhead NOT found at: ${letterheadPath}`);
            }
        } catch (err) {
            console.error('[OfficeDocument] generatePDF: Error reading letterhead:', err);
        }

        console.log('[OfficeDocument] generatePDF: Launching Puppeteer...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        console.log('[OfficeDocument] generatePDF: Page created.');

        // 210mm x 297mm (A4)
        const htmlContent = `
            <html>
            <head>
                <style>
                    @page {
                        size: A4;
                        margin-top: 50mm; /* Space for Header */
                        margin-bottom: 20mm;
                        margin-left: 20mm;
                        margin-right: 20mm;
                    }
                    body {
                        font-family: 'Arial', sans-serif;
                        font-size: 12pt;
                        line-height: 1.6;
                        color: #333;
                    }
                    .letterhead-bg {
                        position: fixed;
                        top: -50mm; /* Move up into margin */
                        left: -20mm;
                        width: 210mm;
                        height: 297mm;
                        background-image: url('${letterheadBase64}');
                        background-size: cover;
                        background-repeat: no-repeat;
                        z-index: -1;
                    }
                    .content {
                        width: 100%;
                    }
                </style>
            </head>
            <body>
                <div class="letterhead-bg"></div>
                <div class="content">
                    ${content}
                </div>
            </body>
            </html>
        `;

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true
        });

        await browser.close();

        // Save to DB History
        await Document.create({
            title,
            content,
            createdBy: req.user._id
        });

        if (type === 'download') {
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Length': pdfBuffer.length,
            });
            res.send(pdfBuffer);
        } else {
            // Return buffer for internal use (email)
            return pdfBuffer;
        }

    } catch (err) {
        console.error('PDF Generation Error:', err);
        res.status(500).json({ success: false, message: 'PDF Generation Failed' });
    }
};

// @desc    Send Email with PDF
// @route   POST /api/office-documents/send-email
// @access  Private/Admin
export const sendEmail = async (req, res) => {
    try {
        const { title, content, recipientEmail } = req.body;

        // 1. Generate PDF (reuse logic or call internally?)
        // Let's reuse logic by abstracting (refactoring slightly inline for now)

        const letterheadPath = 'C:\\Users\\MFC\\OneDrive\\Desktop\\hun\\public\\letterhead.jpg';
        console.log(`[OfficeDocument] Checking letterhead at: ${letterheadPath}`);

        let letterheadBase64 = '';
        try {
            if (fs.existsSync(letterheadPath)) {
                const imageBuffer = fs.readFileSync(letterheadPath);
                letterheadBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
                console.log('[OfficeDocument] Letterhead loaded successfully.');
            } else {
                console.error(`[OfficeDocument] Letterhead NOT found at: ${letterheadPath}`);
            }
        } catch (err) {
            console.error('[OfficeDocument] Error reading letterhead:', err);
        }



        const htmlContent = `
            <html>
            <head>
                <style>
                    @page {
                        size: A4;
                        margin-top: 50mm; /* Space for Header */
                        margin-bottom: 20mm;
                        margin-left: 20mm;
                        margin-right: 20mm;
                    }
                    body {
                        font-family: 'Arial', sans-serif;
                        font-size: 12pt;
                        line-height: 1.6;
                        color: #333;
                    }
                    .letterhead-bg {
                        position: fixed;
                        top: -50mm; /* Move up into margin */
                        left: -20mm;
                        width: 210mm;
                        height: 297mm;
                        background-image: url('${letterheadBase64}');
                        background-size: cover;
                        background-repeat: no-repeat;
                        z-index: -1;
                    }
                    .content {
                        width: 100%;
                    }
                </style>
            </head>
            <body>
                <div class="letterhead-bg"></div>
                <div class="content">
                    ${content}
                </div>
            </body>
            </html>
        `;

        console.log('[OfficeDocument] sendEmail: Launching Puppeteer...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        console.log('[OfficeDocument] sendEmail: Generating PDF...');
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();
        console.log('[OfficeDocument] sendEmail: PDF Generated and Browser Closed.');

        // 2. Setup Transporter
        const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
        const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
        const REDIRECT_URI = 'https://developers.google.com/oauthplayground';
        const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
        const EMAIL_USER = process.env.EMAIL_USER;

        if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !EMAIL_USER) {
            console.error('[OfficeDocument] Email credentials missing in .env');
            return res.status(500).json({ success: false, message: 'Email credentials not configured' });
        }
        console.log('[OfficeDocument] Email credentials found.');

        const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
        oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

        console.log('[OfficeDocument] Getting Access Token...');
        const accessToken = await oAuth2Client.getAccessToken();
        console.log('[OfficeDocument] Access Token retrieved.');

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: EMAIL_USER,
                clientId: CLIENT_ID,
                clientSecret: CLIENT_SECRET,
                refreshToken: REFRESH_TOKEN,
                accessToken: accessToken.token,
            },
        });
        console.log('[OfficeDocument] Transporter created.');

        // 3. Send Email
        const mailOptions = {
            from: `Hunarmand Punjab <${EMAIL_USER}>`,
            to: recipientEmail,
            subject: `Official Document: ${title}`,
            text: 'Please find the attached official document.',
            attachments: [
                {
                    filename: `${title.replace(/\s+/g, '_')}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        console.log(`[OfficeDocument] Sending email to: ${recipientEmail}...`);
        const result = await transporter.sendMail(mailOptions);
        console.log('[OfficeDocument] Email sent successfully. Result:', result);

        // Save to DB
        await Document.create({
            title,
            content,
            recipientEmail,
            createdBy: req.user._id
        });

        res.status(200).json({ success: true, message: 'Email sent successfully', messageId: result.messageId });

    } catch (err) {
        console.error('Email Sending Error:', err);
        console.error('Stack:', err.stack);
        res.status(500).json({ success: false, message: 'Failed to send email: ' + err.message });
    }
};
