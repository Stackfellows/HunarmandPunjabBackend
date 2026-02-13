import mongoose from 'mongoose';
import Salary from '../Models/Salary.js';
import Transaction from '../Models/Transaction.js';
import PaymentAccount from '../Models/PaymentAccount.js';
import Attendance from '../Models/attendance.js';
import User from '../Models/auth.js';

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
        const { paymentAccountId, transactionId } = req.body;

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
            createdBy: req.user._id
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
