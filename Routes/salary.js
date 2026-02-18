import express from 'express';
import {
    createSalary,
    getSalaries,
    paySalary,
    getSalarySlip,
    updateSalary,
    deleteSalary,
    getSalaryCalculation,
    getEmployeeOverallSalary,
    getOverallSalaryStats,
    exportLifetimeSalaryReport,
    exportSingleSalarySlip
} from '../Controllers/salaryController.js';

import { protect, admin } from '../middlewares/auth.js';

const router = express.Router();

// All routes are protected and restricted to admin
router.use(protect);
router.use(admin);

router.route('/')
    .post(createSalary)
    .get(getSalaries);

router.get('/calculate', getSalaryCalculation);

router.get('/employee/:id/overall', getEmployeeOverallSalary); // Removed redundant protect, admin as router.use already applies them
router.get('/overall/stats', getOverallSalaryStats);

router.route('/:id')
    .put(updateSalary)
    .delete(deleteSalary);

router.put('/:id/pay', paySalary);
router.get('/:id/slip', getSalarySlip);
router.get('/export/lifetime/:id', exportLifetimeSalaryReport);
router.get('/export/slip/:id', exportSingleSalarySlip);

export default router;

