import express from 'express';
import {
    addExpense,
    getExpenses,
    updateExpense,
    deleteExpense,
    downloadPDFReport
} from '../Controllers/officeAccount.js';
import {
    getTransactions,
    getTransactionById,
    getTransactionsByAccount
} from '../Controllers/transactionController.js';
import { protect, admin } from '../middlewares/auth.js';

const router = express.Router();

// All routes are protected and restricted to admin
router.use(protect);
router.use(admin);

router.route('/expenses')
    .post(addExpense)
    .get(getExpenses);

router.route('/expenses/:id')
    .put(updateExpense)
    .delete(deleteExpense);

router.get('/reports/download', downloadPDFReport);

// Transaction routes
router.route('/transactions')
    .get(getTransactions);

router.route('/transactions/:id')
    .get(getTransactionById);

router.route('/transactions/account/:accountId')
    .get(getTransactionsByAccount);

export default router;
