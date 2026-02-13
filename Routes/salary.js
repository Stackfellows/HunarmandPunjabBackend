import express from 'express';
import {
    createSalary,
    getSalaries,
    paySalary,
    getSalarySlip,
    updateSalary,
    deleteSalary,
    getSalaryCalculation
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

router.route('/:id')
    .put(updateSalary)
    .delete(deleteSalary);

router.put('/:id/pay', paySalary);
router.get('/:id/slip', getSalarySlip);

export default router;
