import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './DB/db.js';

// Route Imports
import adminRoutes from './Routes/admin.js';
import authRoutes from './Routes/auth.js';
import employeeRoutes from './Routes/employee.js';
import attendanceRoutes from './Routes/attendance.js';
import profileRoutes from './Routes/profile.js';
import payrollRoutes from './Routes/payroll.js';
import uploadRoutes from './Routes/upload.js';
import officeAccountRoutes from './Routes/officeAccount.js';

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
app.use('/api/upload', uploadRoutes); // Route already protected in the file itself

// Basic Route
app.get('/', (req, res) => {
    res.send('API is running...');
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
