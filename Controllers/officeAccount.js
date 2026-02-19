import Expense from '../Models/expense.js';
import ActivityLog from '../Models/ActivityLog.js';
import Transaction from '../Models/Transaction.js';
import PaymentAccount from '../Models/PaymentAccount.js';
import PDFDocument from 'pdfkit';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

// @desc    Add new expense
// @route   POST /api/office-account/expenses
// @access  Private/Admin
export const addExpense = async (req, res) => {
    try {
        console.log('[DEBUG] Add expense body:', req.body);
        const { title, amount, date, category, notes, paymentAccountId, transactionId, paidBy } = req.body;

        // Determine paidBy role
        let expensePaidBy = 'Manager';
        if (req.user.role === 'admin') {
            expensePaidBy = paidBy || 'Manager';
        } else {
            // For non-admins, force paidBy to be their role if it's a valid role
            // Mapping user roles to paidBy values: CEO -> CEO, Manager -> Manager, COO -> COO
            if (['CEO', 'Manager', 'COO'].includes(req.user.role)) {
                expensePaidBy = req.user.role;
            } else {
                // If user is just 'employee', default to Manager? Or should we block? 
                // Assuming standard employee shouldn't be adding office expenses unless authorized as one of these roles.
                // For now, let's allow it but default to Manager, effectively they are acting on behalf of Manager.
                // OR better, we can set paidBy to 'Other' or their specific name if needed, but requirements say CEO/Manager/COO.
                expensePaidBy = 'Manager';
            }
        }

        // Validate payment account if provided
        let paymentAccount = null;
        let paymentMethod = null;

        if (paymentAccountId) {
            paymentAccount = await PaymentAccount.findById(paymentAccountId);
            if (!paymentAccount) {
                return res.status(404).json({
                    success: false,
                    message: 'Payment account not found'
                });
            }
            // Set payment method based on account type
            paymentMethod = paymentAccount.accountType === 'Bank'
                ? `${paymentAccount.bankName} Bank`
                : paymentAccount.accountType;
        }

        const expense = await Expense.create({
            title,
            amount: Number(amount),
            date: date || new Date(),
            category,
            notes,
            paymentAccount: paymentAccountId || null,
            transactionId: transactionId || null,
            paymentMethod: paymentMethod,
            paymentDate: paymentAccountId ? new Date() : null,
            createdBy: req.user._id,
            paidBy: expensePaidBy
        });

        // Create transaction record if payment account is specified
        let transaction = null;
        if (paymentAccountId) {
            transaction = await Transaction.create({
                date: expense.date,
                amount: expense.amount,
                purpose: 'Expense',
                paymentAccount: paymentAccountId,
                transactionId: transactionId || null,
                description: `${category}: ${title}`,
                relatedExpense: expense._id,
                createdBy: req.user._id,
                paidBy: expensePaidBy
            });
        }

        console.log('[DEBUG] Expense created:', expense._id);
        res.status(201).json({
            success: true,
            data: expense,
            transaction
        });

        // Audit Log
        await ActivityLog.create({
            action: 'CREATE',
            targetType: 'Expense',
            targetId: expense._id,
            description: `Expense added: ${expense.title} (Category: ${expense.category})`,
            newValue: expense,
            performedBy: expensePaidBy,
            user: req.user._id
        });
    } catch (err) {
        console.error('[DEBUG] Add expense error:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get expenses with filters (daily, monthly, yearly)
// @route   GET /api/office-account/expenses
// @access  Private/Admin
export const getExpenses = async (req, res) => {
    try {
        const { type, date, role } = req.query; // type: daily, monthly, yearly. role: Manager, CEO, COO
        let queryDate = date ? new Date(date) : new Date();
        let startDate, endDate;

        if (type === 'monthly') {
            startDate = startOfMonth(queryDate);
            endDate = endOfMonth(queryDate);
        } else if (type === 'yearly') {
            startDate = startOfYear(queryDate);
            endDate = endOfYear(queryDate);
        } else {
            // default daily
            startDate = startOfDay(queryDate);
            endDate = endOfDay(queryDate);
        }

        // Build query
        let query = {
            date: { $gte: startDate, $lte: endDate }
        };

        // Role restriction
        if (req.user.role === 'admin') {
            // Admin can see all, or filter by role if provided
            if (role) {
                query.paidBy = role;
            }
        } else {
            if (['CEO', 'Manager', 'COO'].includes(req.user.role)) {
                query.paidBy = req.user.role;
            } else {
                // Regular employees see nothing
                return res.status(403).json({ success: false, message: 'Not authorized to view expenses' });
            }
        }

        const expenses = await Expense.find(query)
            .populate('paymentAccount', 'accountName accountType bankName')
            .sort({ date: -1 });

        const total = expenses.reduce((acc, curr) => acc + curr.amount, 0);

        res.status(200).json({
            success: true,
            count: expenses.length,
            total,
            data: expenses
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Update expense
// @route   PUT /api/office-account/expenses/:id
// @access  Private/Admin
export const updateExpense = async (req, res) => {
    try {
        const previousExpense = await Expense.findById(req.params.id);
        if (!previousExpense) return res.status(404).json({ success: false, message: 'Expense not found' });

        // Authorization check for update
        if (req.user.role !== 'admin' && previousExpense.paidBy !== req.user.role) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this expense' });
        }

        const previousValue = previousExpense.toObject();

        const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!expense) {
            return res.status(404).json({ success: false, message: 'Expense not found' });
        }

        const newValue = expense.toObject();

        // Audit Log
        await ActivityLog.create({
            action: 'UPDATE',
            targetType: 'Expense',
            targetId: expense._id,
            description: `Expense updated: ${expense.title}`,
            previousValue,
            newValue,
            performedBy: req.user.role === 'admin' ? 'Admin' : req.user.role,
            user: req.user._id
        });

        res.status(200).json({ success: true, data: expense });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};


// @desc    Delete expense
// @route   DELETE /api/office-account/expenses/:id
// @access  Private/Admin
export const deleteExpense = async (req, res) => {
    try {
        const expenseToDelete = await Expense.findById(req.params.id);
        if (!expenseToDelete) return res.status(404).json({ success: false, message: 'Expense not found' });

        // Authorization check for delete
        if (req.user.role !== 'admin' && expenseToDelete.paidBy !== req.user.role) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this expense' });
        }

        await Expense.findByIdAndDelete(req.params.id);

        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Download PDF Report
// @route   GET /api/office-account/reports/download
// @access  Private/Admin
export const downloadPDFReport = async (req, res) => {
    try {
        const { type, date, role } = req.query;
        let queryDate = date ? new Date(date) : new Date();
        let startDate, endDate, title;

        if (type === 'monthly') {
            startDate = startOfMonth(queryDate);
            endDate = endOfMonth(queryDate);
            title = `Monthly Expense Report - ${format(queryDate, 'MMMM yyyy')}`;
        } else if (type === 'yearly') {
            startDate = startOfYear(queryDate);
            endDate = endOfYear(queryDate);
            title = `Yearly Expense Report - ${format(queryDate, 'yyyy')}`;
        } else {
            startDate = startOfDay(queryDate);
            endDate = endOfDay(queryDate);
            title = `Daily Expense Report - ${format(queryDate, 'dd MMM yyyy')}`;
        }

        // Build query
        let query = {
            date: { $gte: startDate, $lte: endDate }
        };

        // Role restriction
        let reportRole = 'Manager'; // Default for title if not specific?
        if (req.user.role === 'admin') {
            if (role) {
                query.paidBy = role;
                reportRole = role; // Use requested role for title
            } else {
                reportRole = 'Admin View';
            }
        } else {
            if (['CEO', 'Manager', 'COO'].includes(req.user.role)) {
                query.paidBy = req.user.role;
                reportRole = req.user.role;
            } else {
                return res.status(403).json({ success: false, message: 'Not authorized to view expenses' });
            }
        }


        // Update Title with Role
        title += ` (${reportRole})`;

        const expenses = await Expense.find(query).sort({ date: 1 });
        const total = expenses.reduce((acc, curr) => acc + curr.amount, 0);

        const doc = new PDFDocument({ margin: 50 });
        let filename = `Report_${type}_${format(queryDate, 'yyyy-MM-dd')}.pdf`;

        res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

        // Header
        doc.fontSize(20).text('HUNARMAND PUNJAB', { align: 'center' });
        doc.fontSize(10).text('OFFICE ACCOUNT FINANCIAL STATEMENT', { align: 'center' });
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        // Report Info
        doc.fontSize(14).font('Helvetica-Bold').text(title);
        doc.fontSize(10).font('Helvetica').text(`Generated on: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`);
        doc.moveDown();

        // Table Header
        const tableTop = doc.y;
        doc.font('Helvetica-Bold');
        doc.text('Date', 50, tableTop);
        doc.text('Description', 130, tableTop);
        doc.text('Category', 300, tableTop);
        doc.text('Paid By', 400, tableTop);
        doc.text('Amount', 480, tableTop, { align: 'right' });
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#eeeeee').stroke();
        doc.moveDown(0.5);

        // Table Rows
        doc.font('Helvetica');
        expenses.forEach(exp => {
            const y = doc.y;
            if (y > 700) doc.addPage();

            doc.text(format(exp.date, 'dd/MM/yy'), 50, y);
            doc.text(exp.title, 130, y, { width: 160 });
            doc.text(exp.category, 300, y);
            doc.text(exp.paidBy || 'Manager', 400, y);
            doc.text(`Rs. ${exp.amount.toLocaleString()}`, 480, y, { align: 'right' });
            doc.moveDown();
        });

        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#000000').stroke();
        doc.moveDown();

        // Total
        doc.fontSize(12).font('Helvetica-Bold').text('Total Expenditure:', 350, doc.y);
        doc.fontSize(14).text(`Rs. ${total.toLocaleString()}`, 480, doc.y - 2, { align: 'right' });

        doc.moveDown(3);
        doc.fontSize(8).font('Helvetica-Oblique').text('This is a computer generated report and does not require a signature.', { align: 'center', color: 'grey' });

        doc.end();

    } catch (err) {
        console.error(err);
        res.status(400).json({ success: false, message: err.message });
    }
};
