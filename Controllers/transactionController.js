import Transaction from '../Models/Transaction.js';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

// @desc    Get all transactions with filters
// @route   GET /api/office-account/transactions
// @access  Private/Admin
export const getTransactions = async (req, res) => {
    try {
        const { purpose, accountId, startDate, endDate, type, date } = req.query;

        let query = {};

        // Filter by purpose if provided
        if (purpose) {
            query.purpose = purpose;
        }

        // Filter by payment account if provided
        if (accountId) {
            query.paymentAccount = accountId;
        }

        // Date filtering
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        } else if (type && date) {
            // Similar to expense filtering
            let queryDate = date ? new Date(date) : new Date();
            let start, end;

            if (type === 'monthly') {
                start = startOfMonth(queryDate);
                end = endOfMonth(queryDate);
            } else if (type === 'yearly') {
                start = startOfYear(queryDate);
                end = endOfYear(queryDate);
            } else {
                start = startOfDay(queryDate);
                end = endOfDay(queryDate);
            }

            query.date = { $gte: start, $lte: end };
        }

        const transactions = await Transaction.find(query)
            .populate('paymentAccount', 'accountName accountType bankName')
            .populate('relatedExpense', 'title category')
            .populate('relatedSalary', 'employee month year')
            .populate('createdBy', 'name email')
            .sort({ date: -1 });

        const total = transactions.reduce((acc, curr) => acc + curr.amount, 0);

        res.status(200).json({
            success: true,
            count: transactions.length,
            total,
            data: transactions
        });
    } catch (err) {
        console.error('[ERROR] Get transactions:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get single transaction
// @route   GET /api/office-account/transactions/:id
// @access  Private/Admin
export const getTransactionById = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id)
            .populate('paymentAccount', 'accountName accountType bankName accountNumber')
            .populate('relatedExpense')
            .populate('relatedSalary')
            .populate('createdBy', 'name email');

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        res.status(200).json({
            success: true,
            data: transaction
        });
    } catch (err) {
        console.error('[ERROR] Get transaction by ID:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get transactions by payment account
// @route   GET /api/office-account/transactions/account/:accountId
// @access  Private/Admin
export const getTransactionsByAccount = async (req, res) => {
    try {
        const transactions = await Transaction.find({
            paymentAccount: req.params.accountId
        })
            .populate('relatedExpense', 'title category')
            .populate('relatedSalary', 'employee month year')
            .sort({ date: -1 });

        const total = transactions.reduce((acc, curr) => acc + curr.amount, 0);

        res.status(200).json({
            success: true,
            count: transactions.length,
            total,
            data: transactions
        });
    } catch (err) {
        console.error('[ERROR] Get transactions by account:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};
