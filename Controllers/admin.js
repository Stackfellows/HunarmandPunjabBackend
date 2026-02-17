import User from '../Models/auth.js';
import Task from '../Models/task.js';
import Notification from '../Models/notification.js';
import WorkProgress from '../Models/workProgress.js';
import PDFDocument from 'pdfkit';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, startOfYear, endOfYear } from 'date-fns';
import ActivityLog from '../Models/ActivityLog.js';

// @desc    Register a new employee
// @route   POST /api/admin/employees
// @access  Private/Admin
export const createEmployee = async (req, res) => {
    const {
        name, cnic, department, title, shift, workplace, salary, avatar,
        phoneNumber, address, bloodGroup, lastDegree, experience,
        emergencyContact, bankDetails, defaultAllowances, defaultDeductions
    } = req.body;



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
            defaultAllowances: defaultAllowances || 0,
            defaultDeductions: defaultDeductions || 0,
            erpId: 'HP-' + Math.floor(1000 + Math.random() * 9000),
        };


        if (avatar && avatar.trim() !== '') {
            userData.avatar = avatar;
        }

        // Add detailed info
        userData.phoneNumber = phoneNumber;
        userData.address = address;
        userData.bloodGroup = bloodGroup;
        userData.lastDegree = lastDegree;
        userData.experience = experience;
        userData.emergencyContact = emergencyContact;
        userData.bankDetails = bankDetails;


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

            // Audit Log
            await ActivityLog.create({
                action: 'CREATE',
                targetType: 'User',
                targetId: user._id,
                description: `New employee created: ${user.name} (ERP: ${user.erpId})`,
                newValue: {
                    name, department, title, salary,
                    phoneNumber, address, bloodGroup, lastDegree, experience,
                    emergencyContact, bankDetails
                },

                performedBy: 'Admin',
                user: req.user._id
            });
        } else {
            res.status(400).json({ success: false, message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update employee details
// @route   PUT /api/admin/employees/:id
// @access  Private/Admin
export const updateEmployee = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'Employee not found' });

        const previousValue = user.toObject();
        delete previousValue.password;

        const {
            name, department, title, shift, workplace, salary, status,
            phoneNumber, address, bloodGroup, lastDegree, experience,
            emergencyContact, bankDetails, avatar, defaultAllowances, defaultDeductions
        } = req.body;

        // Update fields if provided
        if (name) user.name = name;
        if (department) user.department = department;
        if (title) user.title = title;
        if (shift) user.shift = shift;
        if (workplace) user.workplace = workplace;
        if (salary !== undefined) user.salary = salary;
        if (defaultAllowances !== undefined) user.defaultAllowances = defaultAllowances;
        if (defaultDeductions !== undefined) user.defaultDeductions = defaultDeductions;

        if (status) user.status = status;
        if (phoneNumber) user.phoneNumber = phoneNumber;
        if (address) user.address = address;
        if (bloodGroup) user.bloodGroup = bloodGroup;
        if (lastDegree) user.lastDegree = lastDegree;
        if (experience) user.experience = experience;
        if (emergencyContact) user.emergencyContact = emergencyContact;
        if (bankDetails) user.bankDetails = bankDetails;
        if (avatar) user.avatar = avatar;

        await user.save();

        const newValue = user.toObject();
        delete newValue.password;

        // Audit Log
        await ActivityLog.create({
            action: 'UPDATE',
            targetType: 'User',
            targetId: user._id,
            description: `Employee profile updated: ${user.name}`,
            previousValue,
            newValue,
            performedBy: 'Admin',
            user: req.user._id
        });

        res.json({ success: true, message: 'Employee updated successfully', user: newValue });
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

// @desc    Get all work progress reports
// @route   GET /api/admin/work-progress
// @access  Private/Admin
export const getWorkProgress = async (req, res) => {
    try {
        const { userId, day, month, year } = req.query;
        let query = {};

        if (userId) query.user = userId;

        if (day || month || year) {
            let startDate, endDate;

            if (day && month && year) {
                // Specific Day
                const dateStr = `${month} ${day}, ${year}`;
                startDate = startOfDay(new Date(dateStr));
                endDate = endOfDay(new Date(dateStr));
            } else if (month && year) {
                // Specific Month
                const dateStr = `${month} 1, ${year}`;
                startDate = startOfMonth(new Date(dateStr));
                endDate = endOfMonth(new Date(dateStr));
            } else if (year) {
                // Specific Year
                const dateStr = `January 1, ${year}`;
                startDate = startOfYear(new Date(dateStr));
                endDate = endOfYear(new Date(dateStr));
            }

            if (startDate && endDate) {
                query.createdAt = { $gte: startDate, $lte: endDate };
            }
        }

        const progress = await WorkProgress.find(query)
            .populate('user', 'name erpId department avatar')
            .sort({ createdAt: -1 });

        res.json({ success: true, workProgress: progress });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update work progress status
// @route   PATCH /api/admin/work-progress/:id
// @access  Private/Admin
export const updateWorkProgressStatus = async (req, res) => {
    const { status } = req.body;

    try {
        const progress = await WorkProgress.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!progress) {
            return res.status(404).json({ success: false, message: 'Work progress report not found' });
        }

        // If marked as Reviewed, notify the employee
        if (status === 'Reviewed') {
            await Notification.create({
                user: progress.user,
                message: `Your work progress update for "${progress.task.substring(0, 20)}${progress.task.length > 20 ? '...' : ''}" has been reviewed and marked as OK by Admin.`,
                type: 'Alert'
            });
        }

        res.json({ success: true, message: `Status updated to ${status}`, workProgress: progress });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Download Monthly Work Progress PDF
// @route   GET /api/admin/work-progress/export/:userId
// @access  Private/Admin
export const downloadWorkProgressPDF = async (req, res) => {
    try {
        const { userId } = req.params;
        const { month, year } = req.query; // e.g. "February", "2026"

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const startDate = startOfMonth(new Date(`${month} 1, ${year}`));
        const endDate = endOfMonth(new Date(`${month} 1, ${year}`));

        const progress = await WorkProgress.find({
            user: userId,
            createdAt: { $gte: startDate, $lte: endDate }
        }).sort({ createdAt: 1 });

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-disposition', `attachment; filename="WorkProgress_${user.name}_${month}_${year}.pdf"`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        // Header
        doc.fontSize(20).text('HUNARMAND PUNJAB', { align: 'center' });
        doc.fontSize(12).text('MONTHLY WORK PERFORMANCE REPORT', { align: 'center' });
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        // Employee Info
        doc.fontSize(10).font('Helvetica-Bold').text(`Employee: ${user.name}`);
        doc.text(`ERP ID: ${user.erpId}`);
        doc.text(`Department: ${user.department}`);
        doc.text(`Reporting Period: ${month} ${year}`);
        doc.moveDown();

        // Table Header
        const tableTop = doc.y;
        doc.font('Helvetica-Bold');
        doc.text('Date', 50, tableTop);
        doc.text('Task Description', 130, tableTop);
        doc.text('Status', 450, tableTop, { align: 'right' });
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#eeeeee').stroke();
        doc.moveDown(0.5);

        // Rows
        doc.font('Helvetica');
        progress.forEach(item => {
            const y = doc.y;
            if (y > 700) doc.addPage();
            doc.text(format(item.createdAt, 'dd/MM/yy'), 50, y);
            doc.text(item.task, 130, y, { width: 300 });
            doc.text(item.status, 450, y, { align: 'right' });
            doc.moveDown();
        });

        doc.moveDown(2);
        doc.fontSize(8).text('Generated by Hunarmand Punjab ERP System', { align: 'center', color: 'gray' });
        doc.end();

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

