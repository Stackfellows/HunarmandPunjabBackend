import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './Models/auth.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const diagnose = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const adminCnic = '31103-5286493-9';
        const user = await User.findOne({ cnic: adminCnic });

        if (!user) {
            console.log('Admin user NOT FOUND in database.');
        } else {
            console.log('Admin user FOUND.');
            console.log('CNIC in DB:', `"${user.cnic}"`);
            console.log('Role:', user.role);

            const testPassword = 'hrpunjaberp';
            const isMatch = await bcrypt.compare(testPassword, user.password);
            console.log(`Manual Bcrypt Check ("${testPassword}"): ${isMatch}`);

            if (!isMatch) {
                console.log('Hash in DB:', user.password);
                // Let's try to hash it again and compare
                const salt = await bcrypt.genSalt(10);
                const newHash = await bcrypt.hash(testPassword, salt);
                const checkNew = await bcrypt.compare(testPassword, newHash);
                console.log('Verification check with new hash:', checkNew);
            }
        }

        await mongoose.connection.close();
        process.exit();
    } catch (err) {
        console.error('Diagnostic error:', err);
        process.exit(1);
    }
};

diagnose();
