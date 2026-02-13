import Expense from '../Models/expense.js';
import PDFDocument from 'pdfkit';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

// @desc    Add new expense
// @route   POST /api/office-account/expenses
// @access  Private/Admin
export const addExpense = async (req, res) => {
    try {
        console.log('[DEBUG] Add expense body:', req.body);
        const { title, amount, date, category, notes } = req.body;

        const expense = await Expense.create({
            title,
            amount: Number(amount),
            date: date || new Date(),
            category,
            notes,
            createdBy: req.user._id
        });

        console.log('[DEBUG] Expense created:', expense._id);
        res.status(201).json({
            success: true,
            data: expense
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
        const { type, date } = req.query; // type: daily, monthly, yearly
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

        const expenses = await Expense.find({
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: -1 });

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
        const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!expense) {
            return res.status(404).json({ success: false, message: 'Expense not found' });
        }

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
        const expense = await Expense.findByIdAndDelete(req.params.id);

        if (!expense) {
            return res.status(404).json({ success: false, message: 'Expense not found' });
        }

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
        const { type, date } = req.query;
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

        const expenses = await Expense.find({
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 });

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
        doc.text('Category', 350, tableTop);
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
            doc.text(exp.title, 130, y, { width: 210 });
            doc.text(exp.category, 350, y);
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
