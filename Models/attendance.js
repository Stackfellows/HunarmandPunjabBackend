import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: String,
        required: true // format: YYYY-MM-DD
    },
    checkIn: {
        type: String // format: HH:mm:ss
    },
    checkOut: {
        type: String // format: HH:mm:ss
    },
    status: {
        type: String,
        enum: ['Present', 'Absent', 'Late', 'Off'],
        default: 'Present'
    }
}, { timestamps: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
