import User from '../Models/auth.js';
import Salary from '../Models/Salary.js';
import { format } from 'date-fns';

/**
 * Automatically generates "Unpaid" salary records for all active employees
 * for the current month and year.
 */
export const generateMonthlySalaries = async () => {
    try {
        const now = new Date();
        const month = format(now, 'MMMM');
        const year = now.getFullYear();

        // 1. Get all active employees
        const employees = await User.find({ role: 'employee', status: 'Active' });

        let createdCount = 0;
        let skippedCount = 0;

        for (const emp of employees) {
            // Check if salary record already exists for this month/year
            const existing = await Salary.findOne({
                employee: emp._id,
                month,
                year
            });

            if (!existing) {
                await Salary.create({
                    employee: emp._id,
                    month,
                    year,
                    basicSalary: emp.salary || 0,
                    netSalary: emp.salary || 0, // Initial net is basic
                    status: 'Unpaid',
                    createdBy: emp._id // System generated, but model requires a user ref usually. Using employee id as a fallback or a dedicated system user id.
                });
                createdCount++;
            } else {
                skippedCount++;
            }
        }

        console.log(`[PAYROLL] Generated ${createdCount} records. Skipped ${skippedCount} existing records for ${month} ${year}.`);
        return { createdCount, skippedCount };
    } catch (error) {
        console.error('[PAYROLL ERROR] Failed to generate monthly salaries:', error);
        throw error;
    }
};
