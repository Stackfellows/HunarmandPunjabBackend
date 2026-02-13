import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: [true, 'Please add a transaction date'],
        default: Date.now
    },
    amount: {
        type: Number,
        required: [true, 'Please add an amount']
    },
    purpose: {
        type: String,
        required: [true, 'Please specify transaction purpose'],
        enum: ['Expense', 'Salary', 'Other']
    },
    paymentAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentAccount',
        required: [true, 'Please specify payment account']
    },
    transactionId: {
        type: String,
        trim: true,
        // External transaction ID from bank/payment system
    },
    description: {
        type: String,
        trim: true
    },
    // References to related records
    relatedExpense: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Expense'
    },
    relatedSalary: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Salary'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Indexes for faster queries
transactionSchema.index({ date: -1 });
transactionSchema.index({ purpose: 1, date: -1 });
transactionSchema.index({ paymentAccount: 1, date: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
