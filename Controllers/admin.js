import User from '../Models/auth.js';
import Task from '../Models/task.js';
import Notification from '../Models/notification.js';

// @desc    Register a new employee
// @route   POST /api/admin/employees
// @access  Private/Admin
export const createEmployee = async (req, res) => {
    const { name, cnic, department, title, shift, workplace, salary, avatar } = req.body;

    try {
        const userExists = await User.findOne({ cnic });

        if (userExists) {
            return res.status(400).json({ success: false, message: 'User with this CNIC already exists' });
        }

        const userData = {
            name,
            cnic,
            password: 'hunarmanderp', // Default password
            role: 'employee',
            department,
            title,
            shift,
            workplace,
            salary,
            erpId: 'HP-' + Math.floor(1000 + Math.random() * 9000),
        };

        if (avatar && avatar.trim() !== '') {
            userData.avatar = avatar;
        }

        const user = await User.create(userData);

        if (user) {
            res.status(201).json({
                success: true,
                message: 'Employee created successfully',
                user: {
                    _id: user._id,
                    name: user.name,
                    cnic: user.cnic,
                    role: user.role,
                }
            });
        } else {
            res.status(400).json({ success: false, message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all employees
// @route   GET /api/admin/employees
// @access  Private/Admin
export const getEmployees = async (req, res) => {
    try {
        const employees = await User.find({ role: 'employee' }).select('-password');
        res.json({ success: true, employees });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Assign task to employee(s)
// @route   POST /api/admin/tasks
// @access  Private/Admin
export const assignTask = async (req, res) => {
    const { assignedTo, description } = req.body;

    try {
        const task = await Task.create({
            assignedTo: assignedTo || null,
            description,
            assignedBy: req.user._id,
        });

        // Create notification
        await Notification.create({
            user: assignedTo || null,
            message: `New Task: ${description}`,
            type: 'Task',
        });

        res.status(201).json({ success: true, message: 'Task assigned successfully', task });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Send broadcast message
// @route   POST /api/admin/broadcast
// @access  Private/Admin
export const sendBroadcast = async (req, res) => {
    const { message } = req.body;

    try {
        const notification = await Notification.create({
            user: null,
            message,
            type: 'Broadcast',
        });

        res.status(201).json({ success: true, message: 'Broadcast sent successfully', notification });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
