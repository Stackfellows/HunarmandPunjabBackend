import mongoose from 'mongoose';

const salarySchema = new mongoose.Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Please specify employee']
    },
    month: {
        type: String,
        required: [true, 'Please specify month'],
        // Format: "January", "February", etc.
    },
    year: {
        type: Number,
        required: [true, 'Please specify year']
    },
    basicSalary: {
        type: Number,
        required: [true, 'Please add basic salary'],
        default: 0
    },
    allowances: {
        type: Number,
        default: 0
    },
    deductions: {
        type: Number,
        default: 0
    },
    lateDays: {
        type: Number,
        default: 0
    },
    lateDeduction: {
        type: Number,
        default: 0
    },
    netSalary: {
        type: Number,
        required: [true, 'Please add net salary']
    },
    status: {
        type: String,
        enum: ['Pending', 'Paid'],
        default: 'Pending'
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
    paidDate: {
        type: Date
    },
    notes: {
        type: String,
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Compound index to prevent duplicate salary records for same employee/month/year
salarySchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });
salarySchema.index({ status: 1, year: -1, month: 1 });

const Salary = mongoose.model('Salary', salarySchema);

export default Salary;
