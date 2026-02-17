import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please add a title or description'],
        trim: true
    },
    amount: {
        type: Number,
        required: [true, 'Please add an amount']
    },
    date: {
        type: Date,
        required: [true, 'Please add a date'],
        default: Date.now
    },
    category: {
        type: String,
        required: [true, 'Please specify a category'],
        enum: ['Utilities', 'Supplies', 'Food', 'Salaries', 'Logistics', 'Maintenance', 'Rent', 'Other']
    },
    notes: {
        type: String,
        trim: true
    },
    // Payment tracking fields
    paymentAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentAccount'
    },
    transactionId: {
        type: String,
        trim: true
    },
    paymentMethod: {
        type: String,
        trim: true
    },
    paymentDate: {
        type: Date
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    paidBy: {
        type: String,
        enum: ['Manager', 'CEO', 'COO', 'Other'],
        default: 'Manager'
    }
}, {
    timestamps: true
});

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;
