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
        enum: ['Present', 'Absent', 'Late', 'Off', 'Half-Day'],
        default: 'Present'
    },
    isHalfDay: {
        type: Boolean,
        default: false
    },
    lateMarks: {
        type: Number,
        default: 0
    },
    earlyLeaveMarks: {
        type: Number,
        default: 0
    },
    overtimeMinutes: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
