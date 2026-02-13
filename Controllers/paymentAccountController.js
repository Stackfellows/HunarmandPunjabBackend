import PaymentAccount from '../Models/PaymentAccount.js';

// @desc    Create new payment account
// @route   POST /api/payment-accounts
// @access  Private/Admin
export const createPaymentAccount = async (req, res) => {
    try {
        const { accountName, accountType, bankName, accountNumber, iban, notes } = req.body;

        const paymentAccount = await PaymentAccount.create({
            accountName,
            accountType,
            bankName,
            accountNumber,
            iban,
            notes,
            createdBy: req.user._id
        });

        res.status(201).json({
            success: true,
            data: paymentAccount
        });
    } catch (err) {
        console.error('[ERROR] Create payment account:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get all payment accounts
// @route   GET /api/payment-accounts
// @access  Private/Admin
export const getPaymentAccounts = async (req, res) => {
    try {
        const { type, active } = req.query;

        let query = {};

        // Filter by type if provided
        if (type) {
            query.accountType = type;
        }

        // Filter by active status (default: only active accounts)
        query.isActive = active === 'false' ? false : true;

        const accounts = await PaymentAccount.find(query)
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: accounts.length,
            data: accounts
        });
    } catch (err) {
        console.error('[ERROR] Get payment accounts:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get single payment account
// @route   GET /api/payment-accounts/:id
// @access  Private/Admin
export const getPaymentAccountById = async (req, res) => {
    try {
        const account = await PaymentAccount.findById(req.params.id)
            .populate('createdBy', 'name email');

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Payment account not found'
            });
        }

        res.status(200).json({
            success: true,
            data: account
        });
    } catch (err) {
        console.error('[ERROR] Get payment account by ID:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Update payment account
// @route   PUT /api/payment-accounts/:id
// @access  Private/Admin
export const updatePaymentAccount = async (req, res) => {
    try {
        const account = await PaymentAccount.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Payment account not found'
            });
        }

        res.status(200).json({
            success: true,
            data: account
        });
    } catch (err) {
        console.error('[ERROR] Update payment account:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Delete payment account (soft delete)
// @route   DELETE /api/payment-accounts/:id
// @access  Private/Admin
export const deletePaymentAccount = async (req, res) => {
    try {
        // Soft delete - set isActive to false to maintain transaction history
        const account = await PaymentAccount.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Payment account not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Payment account deactivated successfully',
            data: {}
        });
    } catch (err) {
        console.error('[ERROR] Delete payment account:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};
