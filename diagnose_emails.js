import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './Models/auth.js';
import connectDB from './DB/db.js';

dotenv.config();

const diagnose = async () => {
    try {
        await connectDB();
        console.log('Connected to DB');

        const employees = await User.find({ role: 'employee' });
        console.log(`Total Employees: ${employees.length}`);

        const employeesWithEmail = await User.find({ role: 'employee', email: { $exists: true, $ne: '' } });
        console.log(`Employees with Email count: ${employeesWithEmail.length}`);

        console.log('--- All Employees ---');
        employees.forEach(e => {
            console.log(`Name: ${e.name}, Role: ${e.role}, Email: "${e.email || 'MISSING'}"`);
        });

        if (employeesWithEmail.length > 0) {
            console.log('--- Valid Emails ---');
            console.log(employeesWithEmail.map(e => e.email));
        } else {
            console.log('NO employees have valid emails.');
        }

        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

diagnose();
