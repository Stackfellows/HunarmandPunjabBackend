import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './Models/auth.js';

dotenv.config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for seeding...');

        const adminCnic = '3110352864939';
        const adminPassword = 'hrpunjaberp';

        const existingAdmin = await User.findOne({ cnic: adminCnic });

        if (existingAdmin) {
            console.log('Admin user already exists. Skipping password update to prevent unintended resets.');
        } else {
            await User.create({
                name: 'System Admin',
                cnic: adminCnic,
                password: adminPassword,
                role: 'admin'
            });
            console.log('Admin user created successfully!');
        }

        mongoose.connection.close();
        process.exit();
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exit(1);
    }
};

seedAdmin();
