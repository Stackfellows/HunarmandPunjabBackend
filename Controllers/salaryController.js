import mongoose from 'mongoose';
import Salary from '../Models/Salary.js';
import ActivityLog from '../Models/ActivityLog.js';
import Transaction from '../Models/Transaction.js';
import PaymentAccount from '../Models/PaymentAccount.js';
import Attendance from '../Models/attendance.js';
import User from '../Models/auth.js';
import { format } from 'date-fns';

// @desc    Calculate salary stats (lates, deductions)
// @route   GET /api/salaries/calculate
// @access  Private/Admin
export const getSalaryCalculation = async (req, res) => {
    try {
        const { employeeId, month, year } = req.query;

        if (!employeeId || !month || !year) {
            return res.status(400).json({
                success: false,
                message: 'Please provide employeeId, month, and year'
            });
        }

        // Get employee basic salary
        const employee = await User.findById(employeeId);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Calculate date range for the selected month/year
        // Assuming month is full name like "January", "February"
        const monthIndex = new Date(`${month} 1, 2024`).getMonth(); // 0-11
        const startDate = new Date(year, monthIndex, 1);
        const endDate = new Date(year, monthIndex + 1, 0);

        // Fetch attendance records
        // Note: Attendance date is stored as String YYYY-MM-DD
        // We need to match string prefix for the month
        const monthStr = (monthIndex + 1).toString().padStart(2, '0');
        const regexPattern = `^${year}-${monthStr}`;

        const attendanceRecords = await Attendance.find({
            user: employeeId,
            date: { $regex: regexPattern }
        });

        const lateCount = attendanceRecords.filter(a => a.status === 'Late').length;

        // Logical Rule: 3 Lates = 1 Day Deduction
        const deductibleDays = Math.floor(lateCount / 3);

        // Calculate amount: (Basic Salary / 30) * Deductible Days
        const dailyRate = (employee.salary || 0) / 30;
        const deductionAmount = Math.round(dailyRate * deductibleDays);

        res.status(200).json({
            success: true,
            data: {
                lateDays: lateCount,
                deductibleDays,
                deductionAmount,
                basicSalary: employee.salary || 0,
                dailyRate: Math.round(dailyRate)
            }
        });

    } catch (err) {
        console.error('[ERROR] Calculate salary:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Create salary record
// @route   POST /api/salaries
// @access  Private/Admin
export const createSalary = async (req, res) => {
    try {
        const { employee, month, year, basicSalary, allowances, deductions, lateDays, lateDeduction, notes } = req.body;

        // Calculate net salary
        const netSalary = (basicSalary || 0) + (allowances || 0) - (deductions || 0);

        const salary = await Salary.create({
            employee,
            month,
            year,
            basicSalary,
            allowances,
            deductions,
            lateDays: lateDays || 0,
            lateDeduction: lateDeduction || 0,
            netSalary,
            notes,
            createdBy: req.user._id
        });

        // Populate employee details
        await salary.populate('employee', 'name email designation');

        res.status(201).json({
            success: true,
            data: salary
        });
    } catch (err) {
        console.error('[ERROR] Create salary:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get all salaries with filters
// @route   GET /api/salaries
// @access  Private/Admin
export const getSalaries = async (req, res) => {
    try {
        const { month, year, status, employeeId } = req.query;

        let query = {};

        if (month) query.month = month;
        if (year) query.year = parseInt(year);
        if (status) query.status = status;
        if (employeeId) query.employee = employeeId;

        const salaries = await Salary.find(query)
            .populate('employee', 'name email designation profileImage erpId')
            .populate('paymentAccount', 'accountName accountType bankName')
            .populate('createdBy', 'name email')
            .sort({ year: -1, month: -1 });

        const totalPaid = salaries
            .filter(s => s.status === 'Paid')
            .reduce((acc, curr) => acc + curr.netSalary, 0);

        const totalPending = salaries
            .filter(s => s.status === 'Pending')
            .reduce((acc, curr) => acc + curr.netSalary, 0);

        res.status(200).json({
            success: true,
            count: salaries.length,
            totalPaid,
            totalPending,
            data: salaries
        });
    } catch (err) {
        console.error('[ERROR] Get salaries:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Pay salary (mark as paid with payment details)
// @route   PUT /api/salaries/:id/pay
// @access  Private/Admin
export const paySalary = async (req, res) => {
    try {
        const { paymentAccountId, transactionId, paidBy } = req.body;

        // Find salary record
        const salary = await Salary.findById(req.params.id);

        if (!salary) {
            return res.status(404).json({
                success: false,
                message: 'Salary record not found'
            });
        }

        if (salary.status === 'Paid') {
            return res.status(400).json({
                success: false,
                message: 'Salary already paid'
            });
        }

        let paymentAccountIdToUse = paymentAccountId;

        // Check if paymentAccountId is a valid ObjectId
        // If not, assume it's a name (e.g. "JazzCash", "Easypaisa") and find/create it
        if (!mongoose.Types.ObjectId.isValid(paymentAccountId)) {
            let account = await PaymentAccount.findOne({
                accountName: { $regex: new RegExp(`^${paymentAccountId}$`, 'i') }
            });

            if (!account) {
                // Auto-create if not found
                account = await PaymentAccount.create({
                    accountName: paymentAccountId,
                    accountType: ['JazzCash', 'Easypaisa', 'SadaPay'].includes(paymentAccountId) ? 'Other' : 'Bank',
                    bankName: paymentAccountId, // Use same for bank name
                    createdBy: req.user._id
                });
            }
            paymentAccountIdToUse = account._id;
        }

        // Get payment account details (verification)
        const paymentAccount = await PaymentAccount.findById(paymentAccountIdToUse);

        if (!paymentAccount) {
            return res.status(404).json({
                success: false,
                message: 'Payment account not found'
            });
        }

        // Update salary record
        salary.status = 'Paid';
        salary.paymentAccount = paymentAccountIdToUse;
        salary.transactionId = transactionId;
        salary.paidDate = new Date();
        salary.paidBy = paidBy || 'Manager';
        await salary.save();

        // Create transaction record
        const transaction = await Transaction.create({
            date: new Date(),
            amount: salary.netSalary,
            purpose: 'Salary',
            paymentAccount: paymentAccountIdToUse,
            transactionId,
            description: `Salary payment for ${salary.month} ${salary.year}`,
            relatedSalary: salary._id,
            createdBy: req.user._id,
            paidBy: paidBy || 'Manager'
        });

        // Audit Log
        await ActivityLog.create({
            action: 'PAYMENT',
            targetType: 'Salary',
            targetId: salary._id,
            description: `Salary paid for ${salary.month} ${salary.year} to ${salary.employee.name}`,
            newValue: { status: 'Paid', transactionId, paidBy: paidBy || 'Manager' },
            performedBy: paidBy || 'Manager',
            user: req.user._id
        });

        // Populate details
        await salary.populate('employee', 'name email designation');
        await salary.populate('paymentAccount', 'accountName accountType bankName');

        res.status(200).json({
            success: true,
            data: salary,
            transaction
        });
    } catch (err) {
        console.error('[ERROR] Pay salary:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get salary slip
// @route   GET /api/salaries/:id/slip
// @access  Private/Admin
export const getSalarySlip = async (req, res) => {
    try {
        const salary = await Salary.findById(req.params.id)
            .populate('employee', 'name email designation profileImage erpId')
            .populate('paymentAccount', 'accountName accountType bankName')
            .populate('createdBy', 'name email');

        if (!salary) {
            return res.status(404).json({
                success: false,
                message: 'Salary record not found'
            });
        }

        res.status(200).json({
            success: true,
            data: salary
        });
    } catch (err) {
        console.error('[ERROR] Get salary slip:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Update salary record
// @route   PUT /api/salaries/:id
// @access  Private/Admin
export const updateSalary = async (req, res) => {
    try {
        const { basicSalary, allowances, deductions, lateDays, lateDeduction, notes } = req.body;

        const salary = await Salary.findById(req.params.id);

        if (!salary) {
            return res.status(404).json({
                success: false,
                message: 'Salary record not found'
            });
        }

        if (salary.status === 'Paid') {
            return res.status(400).json({
                success: false,
                message: 'Cannot update paid salary'
            });
        }

        const previousValue = salary.toObject();

        // Update fields
        if (basicSalary !== undefined) salary.basicSalary = basicSalary;
        if (allowances !== undefined) salary.allowances = allowances;
        if (deductions !== undefined) salary.deductions = deductions;
        if (lateDays !== undefined) salary.lateDays = lateDays;
        if (lateDeduction !== undefined) salary.lateDeduction = lateDeduction;
        if (notes !== undefined) salary.notes = notes;

        // Recalculate net salary
        salary.netSalary = salary.basicSalary + salary.allowances - salary.deductions;

        await salary.save();
        await salary.populate('employee', 'name email designation');

        const newValue = salary.toObject();

        // Audit Log
        await ActivityLog.create({
            action: 'UPDATE',
            targetType: 'Salary',
            targetId: salary._id,
            description: `Salary record updated for ${salary.month} ${salary.year} (Employee ID: ${salary.employee?._id || salary.employee})`,
            previousValue,
            newValue,
            performedBy: 'Admin',
            user: req.user._id
        });

        res.status(200).json({
            success: true,
            data: salary
        });
    } catch (err) {
        console.error('[ERROR] Update salary:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};


// @desc    Delete salary record
// @route   DELETE /api/salaries/:id
// @access  Private/Admin
export const deleteSalary = async (req, res) => {
    try {
        const salary = await Salary.findById(req.params.id);

        if (!salary) {
            return res.status(404).json({
                success: false,
                message: 'Salary record not found'
            });
        }

        if (salary.status === 'Paid') {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete paid salary'
            });
        }

        await salary.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Salary record deleted successfully',
            data: {}
        });
    } catch (err) {
        console.error('[ERROR] Delete salary:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get overall salary records for an employee
// @route   GET /api/salaries/employee/:id/overall
// @access  Private/Admin
export const getEmployeeOverallSalary = async (req, res) => {
    try {
        const userId = req.params.id;
        const salaries = await Salary.find({ employee: userId })
            .populate('paymentAccount', 'accountName bankName')
            .sort({ year: -1, month: -1 });

        const stats = {
            totalPaid: salaries.filter(s => s.status === 'Paid').reduce((acc, curr) => acc + curr.netSalary, 0),
            totalPending: salaries.filter(s => s.status === 'Unpaid').reduce((acc, curr) => acc + curr.netSalary, 0),
            recordCount: salaries.length
        };

        res.status(200).json({
            success: true,
            data: salaries,
            stats
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get overall salary stats for all employees
// @route   GET /api/salaries/overall/stats
// @access  Private/Admin
export const getOverallSalaryStats = async (req, res) => {
    try {
        const employees = await User.find({ role: 'employee' }).select('name erpId salary avatar createdAt');

        const stats = await Promise.all(employees.map(async (emp) => {
            const salaries = await Salary.find({ employee: emp._id });
            return {
                employeeId: emp._id,
                employeeName: emp.name,
                erpId: emp.erpId,
                basicSalary: emp.salary,
                avatar: emp.avatar,
                joinDate: emp.createdAt,
                totalPaid: salaries.filter(s => s.status === 'Paid').reduce((acc, curr) => acc + curr.netSalary, 0),

                totalPending: salaries.filter(s => s.status === 'Unpaid').reduce((acc, curr) => acc + curr.netSalary, 0),
                recordCount: salaries.length
            };
        }));

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Export lifetime salary report as PDF
// @route   GET /api/salaries/export/lifetime/:id
// @access  Private/Admin
export const exportLifetimeSalaryReport = async (req, res) => {
    try {
        const userId = req.params.id;
        const employee = await User.findById(userId);
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

        const salaries = await Salary.find({ employee: userId }).sort({ year: -1, month: -1 });

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Lifetime_Salary_Report_${employee.name.replace(/\s+/g, '_')}.pdf`);
        doc.pipe(res);

        // Header
        doc.fontSize(24).text('Hunarmand Punjab ERP', { align: 'center' });
        doc.fontSize(16).text('Lifetime Salary Statement', { align: 'center' });
        doc.moveDown();

        // Employee Info
        doc.fontSize(12).text(`Employee Name: ${employee.name}`);
        doc.text(`ERP ID: ${employee.erpId}`);
        doc.text(`Designation: ${employee.title}`);
        doc.text(`Workplace: ${employee.workplace || 'N/A'}`);
        doc.text(`Join Date: ${format(new Date(employee.createdAt), 'MMMM dd, yyyy')}`);

        doc.moveDown();

        // Totals
        const totalPaid = salaries.filter(s => s.status === 'Paid').reduce((acc, curr) => acc + curr.netSalary, 0);
        const totalPending = salaries.filter(s => s.status === 'Unpaid').reduce((acc, curr) => acc + curr.netSalary, 0);

        doc.fontSize(14).font('Helvetica-Bold').text('Financial Summary');
        doc.fontSize(12).font('Helvetica').text(`Total Lifetime Paid: Rs. ${totalPaid.toLocaleString()}`);
        doc.text(`Total Currently Pending: Rs. ${totalPending.toLocaleString()}`);
        doc.moveDown();

        // Records Table
        doc.fontSize(14).font('Helvetica-Bold').text('Detailed Salary History');
        doc.moveDown(0.5);

        // Table Header
        const startX = 50;
        let currentY = doc.y;
        doc.fontSize(10);
        doc.text('Month/Year', startX, currentY);
        doc.text('Basic', startX + 120, currentY);
        doc.text('Allowances', startX + 200, currentY);
        doc.text('Deductions', startX + 280, currentY);
        doc.text('Net Salary', startX + 370, currentY);
        doc.text('Status', startX + 460, currentY);

        doc.moveTo(startX, currentY + 15).lineTo(550, currentY + 15).stroke();
        currentY += 25;

        salaries.forEach((s) => {
            if (currentY > 700) {
                doc.addPage();
                currentY = 50;
            }
            doc.font('Helvetica').text(`${s.month} ${s.year}`, startX, currentY);
            doc.text(`${s.basicSalary.toLocaleString()}`, startX + 120, currentY);
            doc.text(`${s.allowances.toLocaleString()}`, startX + 200, currentY);
            doc.text(`${s.deductions.toLocaleString()}`, startX + 280, currentY);
            doc.font('Helvetica-Bold').text(`${s.netSalary.toLocaleString()}`, startX + 370, currentY);
            doc.font('Helvetica').text(`${s.status}`, startX + 460, currentY);
            currentY += 20;
        });

        doc.end();

        // Audit Log
        await ActivityLog.create({
            action: 'EXPORT',
            targetType: 'Salary',
            targetId: employee._id,
            description: `Lifetime salary report exported for ${employee.name}`,
            performedBy: 'Admin',
            user: req.user._id
        });

    } catch (error) {
        console.error('PDF Export Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};



