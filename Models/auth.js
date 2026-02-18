import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    cnic: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        unique: true,
        sparse: true // Allows multiple null values for existing users without email
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'employee'],
        default: 'employee'
    },
    department: String,
    title: String,
    shift: String,
    erpId: String,
    workplace: String,
    salary: Number,
    defaultAllowances: {
        type: Number,
        default: 0
    },
    defaultDeductions: {
        type: Number,
        default: 0
    },

    joiningDate: {
        type: String,
        default: () => new Date().toLocaleDateString('en-GB')
    },
    avatar: {
        type: String,
        default: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
    },
    phoneNumber: String,
    address: String,
    emergencyContact: {
        name: String,
        relation: String,
        phone: String
    },
    bloodGroup: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'N/A'],
        default: 'N/A'
    },
    lastDegree: String,
    experience: String,
    bankDetails: {
        bankName: String,
        accountTitle: String,
        accountNumber: String,
        branchCode: String,
        iban: String
    },
    status: {
        type: String,
        enum: ['Active', 'On Leave', 'Terminated', 'Resigned'],
        default: 'Active'
    }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Match password
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
