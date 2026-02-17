import ActivityLog from '../Models/ActivityLog.js';

// @desc    Get all activity logs with filters
// @route   GET /api/admin/activity-logs
// @access  Private/Admin
export const getActivityLogs = async (req, res) => {
    try {
        const { action, targetType, startDate, endDate, performedBy } = req.query;
        let query = {};

        if (action) query.action = action;
        if (targetType) query.targetType = targetType;
        if (performedBy) query.performedBy = new RegExp(performedBy, 'i');

        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const logs = await ActivityLog.find(query)
            .populate('user', 'name email avatar')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Add a manual log entry (System Activity)
// @route   POST /api/admin/activity-logs
// @access  Private/Admin
export const createActivityLog = async (req, res) => {
    try {
        const log = await ActivityLog.create({
            ...req.body,
            user: req.user._id
        });
        res.status(201).json({ success: true, data: log });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
