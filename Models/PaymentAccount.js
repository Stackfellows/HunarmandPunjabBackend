import mongoose from 'mongoose';

const paymentAccountSchema = new mongoose.Schema({
    accountName: {
        type: String,
        required: [true, 'Please add an account name'],
        trim: true
    },
    accountType: {
        type: String,
        required: [true, 'Please specify account type'],
        enum: ['Bank', 'JazzCash', 'Easypaisa', 'Other']
    },
    bankName: {
        type: String,
        trim: true,
        // For bank accounts, store the bank name (HBL, UBL, MCB, etc.)
    },
    accountNumber: {
        type: String,
        trim: true,
        // Can be account number, wallet number, etc.
    },
    iban: {
        type: String,
        trim: true,
        // For bank accounts with IBAN
    },
    notes: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Index for faster queries
paymentAccountSchema.index({ isActive: 1, accountType: 1 });

const PaymentAccount = mongoose.model('PaymentAccount', paymentAccountSchema);

export default PaymentAccount;
