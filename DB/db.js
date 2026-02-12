import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connection established successfully");

        // Clean up legacy email unique index if it exists
        try {
            const collections = await mongoose.connection.db.listCollections({ name: 'users' }).toArray();
            if (collections.length > 0) {
                await mongoose.connection.db.collection('users').dropIndex('email_1');
                console.log("Legacy unique index 'email_1' dropped successfully.");
            }
        } catch (err) {
            // Ignore if index doesn't exist
            if (err.codeName !== 'IndexNotFound') {
                console.error("Error checking/dropping index:", err.message);
            }
        }
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
};

export default connectDB;
