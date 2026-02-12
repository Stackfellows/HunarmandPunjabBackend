import User from '../Models/auth.js';
import Attendance from '../Models/attendance.js';
import WorkProgress from '../Models/workProgress.js';
import Task from '../Models/task.js';
import Notification from '../Models/notification.js';

// @desc    Get employee dashboard data
// @route   GET /api/employee/dashboard
// @access  Private
export const getEmployeeDashboard = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Fetch today's attendance status
        const todayStr = new Date().toISOString().split('T')[0];
        const attendance = await Attendance.findOne({ user: req.user._id, date: todayStr });

        // Fetch tasks
        const tasks = await Task.find({
            $or: [{ assignedTo: req.user._id }, { assignedTo: null }]
        }).sort({ createdAt: -1 });

        // Fetch notifications
        const notifications = await Notification.find({
            $or: [{ user: req.user._id }, { user: null }]
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            user,
            notifications,
            tasks,
            attendance: attendance ? { isCheckedIn: !!attendance.checkIn && !attendance.checkOut } : { isCheckedIn: false }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update task status
// @route   PATCH /api/employee/tasks/:id
// @access  Private
export const updateTaskStatus = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        if (task.assignedTo && task.assignedTo.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        task.status = req.body.status || 'Completed';
        await task.save();

        res.json({ success: true, message: 'Task status updated', task });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Submit daily work progress
// @route   POST /api/employee/work-progress
// @access  Private
export const submitWorkProgress = async (req, res) => {
    const { task } = req.body;

    if (!task) {
        return res.status(400).json({ success: false, message: 'Task description is required' });
    }

    try {
        await WorkProgress.create({
            user: req.user._id,
            userName: req.user.name,
            task
        });
        res.json({ success: true, message: 'Work progress submitted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get employee profile
// @route   GET /api/employee/profile
// @access  Private
export const getEmployeeProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
