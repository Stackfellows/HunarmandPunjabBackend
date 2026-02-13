import express from 'express';
import {
    createPaymentAccount,
    getPaymentAccounts,
    getPaymentAccountById,
    updatePaymentAccount,
    deletePaymentAccount
} from '../Controllers/paymentAccountController.js';
import { protect, admin } from '../middlewares/auth.js';

const router = express.Router();

// All routes are protected and restricted to admin
router.use(protect);
router.use(admin);

router.route('/')
    .post(createPaymentAccount)
    .get(getPaymentAccounts);

router.route('/:id')
    .get(getPaymentAccountById)
    .put(updatePaymentAccount)
    .delete(deletePaymentAccount);

export default router;
