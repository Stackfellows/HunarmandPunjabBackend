import Attendance from '../Models/attendance.js';
import User from '../Models/auth.js';
import { format } from 'date-fns';

// @desc    Mark attendance (check-in/out)
// @route   POST /api/attendance/mark
// @access  Private
export const markAttendance = async (req, res) => {
    const { action } = req.body;
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const time = format(now, 'HH:mm:ss'); // HH:mm:ss

    try {
        let attendance = await Attendance.findOne({ user: req.user._id, date: today });

        if (action === 'check-in') {
            if (attendance && attendance.checkIn) {
                return res.status(400).json({ success: false, message: 'Already checked in today' });
            }

            // Calculate status based on 9:30 AM rule
            // 9:30 AM is 09:30:00
            const [hours, minutes] = time.split(':').map(Number);
            let status = 'Present';
            if (hours > 9 || (hours === 9 && minutes > 30)) {
                status = 'Late';
            }

            if (!attendance) {
                attendance = new Attendance({
                    user: req.user._id,
                    date: today,
                    checkIn: time,
                    status
                });
            } else {
                attendance.checkIn = time;
                attendance.status = status;
            }

            await attendance.save();
            res.json({
                success: true,
                message: `Checked in successfully as ${status} at ${time}`,
                status,
                time
            });
        } else if (action === 'check-out') {
            if (!attendance || !attendance.checkIn) {
                return res.status(400).json({ success: false, message: 'Must check in first' });
            }
            if (attendance.checkOut) {
                return res.status(400).json({ success: false, message: 'Already checked out today' });
            }
            attendance.checkOut = time;
            await attendance.save();
            res.json({ success: true, message: 'Checked out successfully at ' + time, time });
        } else {
            res.status(400).json({ success: false, message: 'Invalid action' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get user attendance history
// @route   GET /api/attendance/history
// @access  Private
export const getAttendanceHistory = async (req, res) => {
    try {
        const history = await Attendance.find({ user: req.user._id }).sort({ date: -1 });
        res.json({ success: true, history });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all attendance for today (Admin)
// @route   GET /api/attendance/admin/today
// @access  Private/Admin
export const getTodayAttendanceAdmin = async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    try {
        const attendance = await Attendance.find({ date: today })
            .populate('user', 'name erpId department title')
            .sort({ createdAt: -1 });
        res.json({ success: true, attendance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get specific employee attendance history & stats (Admin)
// @route   GET /api/attendance/admin/stats/:id
// @access  Private/Admin
export const getEmployeeAttendanceHistory = async (req, res) => {
    try {
        const userId = req.params.id;
        const history = await Attendance.find({ user: userId }).sort({ date: -1 }).limit(30);

        // Calculate stats
        const stats = {
            present: await Attendance.countDocuments({ user: userId, status: 'Present' }),
            late: await Attendance.countDocuments({ user: userId, status: 'Late' }),
            absent: await Attendance.countDocuments({ user: userId, status: 'Absent' }),
        };

        const user = await User.findById(userId).select('joiningDate salary');

        res.json({
            success: true,
            history,
            stats,
            user
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
