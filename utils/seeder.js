import User from '../Models/auth.js';

const seedDefaultAdmin = async () => {
    try {
        const adminCnic = '31103-5286493-9';
        const adminPassword = 'hrpunjaberp';

        const existingAdmin = await User.findOne({ cnic: adminCnic });

        if (!existingAdmin) {
            console.log('Seeding default admin user...');
            await User.create({
                name: 'System Admin',
                cnic: adminCnic,
                password: adminPassword,
                role: 'admin'
            });
            console.log('Default admin user created successfully.');
        } else {
            // Admin exists, but we might want to ensure it has the admin role
            if (existingAdmin.role !== 'admin') {
                existingAdmin.role = 'admin';
                await existingAdmin.save();
                console.log('Fixed admin role for existing user.');
            }
        }
    } catch (error) {
        console.error('Error in automatic seeding:', error.message);
    }
};

export default seedDefaultAdmin;
