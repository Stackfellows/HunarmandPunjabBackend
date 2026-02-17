import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cron from 'node-cron';
import connectDB from './DB/db.js';
import WorkProgress from './Models/workProgress.js';
import { generateMonthlySalaries } from './utils/payrollJob.js';

// Automated Salary Generation on 1st of every month at midnight
cron.schedule('0 0 1 * *', async () => {
    try {
        console.log('[CRON] Starting automated salary generation for the new month...');
        await generateMonthlySalaries();
    } catch (error) {
        console.error('[CRON ERROR] Monthly payroll generation failed:', error);
    }
});

// Auto-deletion/Archiving of Work Progress older than 6 months
cron.schedule('0 0 12 * *', async () => {
    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const result = await WorkProgress.deleteMany({
            createdAt: { $lt: sixMonthsAgo }
        });
        console.log(`[SYSTEM] Work Progress cleanup: Deleted ${result.deletedCount} records older than 6 months.`);
    } catch (error) {
        console.error('Failed to clear Work Progress automatically:', error);
    }
});

// Route Imports
import adminRoutes from './Routes/admin.js';
import authRoutes from './Routes/auth.js';
import employeeRoutes from './Routes/employee.js';
import attendanceRoutes from './Routes/attendance.js';
import profileRoutes from './Routes/profile.js';
import payrollRoutes from './Routes/payroll.js';
import uploadRoutes from './Routes/upload.js';
import officeAccountRoutes from './Routes/officeAccount.js';
import paymentAccountRoutes from './Routes/paymentAccount.js';
import activityLogRoutes from './Routes/activityLog.js';
import salaryRoutes from './Routes/salary.js';

// Middleware Imports
import { protect, admin } from './middlewares/auth.js';

// Load environment variables
dotenv.config();

// Connect to Database
connectDB().then(() => {
    import('./utils/seeder.js').then(m => m.default());
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', protect, admin, adminRoutes);
app.use('/api/payroll', protect, admin, payrollRoutes);
app.use('/api/employee', protect, employeeRoutes);
app.use('/api/attendance', protect, attendanceRoutes);
app.use('/api/profile', protect, profileRoutes);
app.use('/api/office-account', officeAccountRoutes);
app.use('/api/payment-accounts', paymentAccountRoutes);
app.use('/api/salaries', salaryRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/upload', uploadRoutes); // Route already protected in the file itself

// Basic Route
app.get('/', (req, res) => {
    res.send('Hunarmand Punjab Backend Running Now');
});

// Error handling middleware
app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode).json({
        success: false,
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Routes initialized');
});
