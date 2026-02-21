import Attendance from '../Models/attendance.js';
import User from '../Models/auth.js';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';

// @desc    Mark attendance (check-in/out)
// @route   POST /api/attendance/mark
// @access  Private
export const markAttendance = async (req, res) => {
    const { action } = req.body;
    // Capture server-side real-time
    // Capture server-side real-time in Pakistan Time (PKT)
    const now = new Date();
    const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }); // YYYY-MM-DD
    const time = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Karachi', hour12: false }); // HH:mm:ss

    try {
        let attendance = await Attendance.findOne({ user: req.user._id, date: today });

        if (action === 'check-in') {
            if (attendance && attendance.checkIn) {
                return res.status(400).json({ success: false, message: 'Already checked in today' });
            }

            // Attendance Rules Logic
            const [hours, minutes] = time.split(':').map(Number);
            const totalMinutes = hours * 60 + minutes;

            let status = 'Present';
            let lateMarks = 0;
            let isHalfDay = false;

            // Rules (New Policy):
            // 9:00 AM = 540 mins
            // 9:10 AM = 550 mins (Grace - Marked Present)
            // 9:11 - 9:30 AM = 551 to 570 mins (Marked Late - 1 Late Mark)
            // 9:31 AM - 1:00 PM = 571 to 780 mins (Marked Half-Day - 50% deduction)
            // After 1:00 PM (13:00) = > 780 mins (Marked Absent - 100% deduction)

            if (totalMinutes <= 550) {
                status = 'Present';
                lateMarks = 0;
            } else if (totalMinutes <= 570) {
                status = 'Late';
                lateMarks = 1;
            } else if (totalMinutes <= 780) {
                status = 'Half-Day';
                isHalfDay = true;
                lateMarks = 0; // Reset late marks if it's already a half-day deduction
            } else {
                status = 'Absent';
                lateMarks = 0; // Reset late marks if it's already a full-day deduction
            }

            if (!attendance) {
                attendance = new Attendance({
                    user: req.user._id,
                    date: today,
                    checkIn: time,
                    status,
                    isHalfDay,
                    lateMarks
                });
            } else {
                attendance.checkIn = time;
                attendance.status = status;
                attendance.isHalfDay = isHalfDay;
                attendance.lateMarks = lateMarks;
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

            // --- Rules (New Policy - Checkout) ---
            // 5:45 PM = 17:45 = 1065 mins
            // 4:00 PM = 16:00 = 960 mins
            // 6:00 PM = 18:00 = 1080 mins

            const [hours, minutes] = time.split(':').map(Number);
            const totalMinutesOut = hours * 60 + minutes;
            const officeEndTimeMins = 18 * 60; // 1080
            const earlyLeaveThreshold = 17 * 60 + 45; // 1065
            const halfDayThreshold = 16 * 60; // 960

            // Reset/Check Early Leave and Half-Day on Checkout
            if (totalMinutesOut < halfDayThreshold) {
                // If leaving before 4:00 PM, mark as Half-Day
                attendance.status = 'Half-Day';
                attendance.isHalfDay = true;
                attendance.earlyLeaveMarks = 0; // It's a bigger deduction now
            } else if (totalMinutesOut < earlyLeaveThreshold) {
                // If leaving between 4:00 PM and 5:45 PM, mark as Early Leave
                // Only if it's not already a Half-Day from check-in
                if (attendance.status !== 'Half-Day' && attendance.status !== 'Absent') {
                    attendance.earlyLeaveMarks = 1;
                }
            } else {
                attendance.earlyLeaveMarks = 0;
            }

            // Overtime Calculation (After 6:00 PM)
            if (totalMinutesOut > officeEndTimeMins) {
                attendance.overtimeMinutes = totalMinutesOut - officeEndTimeMins;
            } else {
                attendance.overtimeMinutes = 0;
            }

            await attendance.save();
            res.json({
                success: true,
                message: `Checked out successfully at ${time}. Status: ${attendance.status}, Early marks: ${attendance.earlyLeaveMarks}`,
                time,
                status: attendance.status,
                earlyLeaveMarks: attendance.earlyLeaveMarks,
                overtimeMinutes: attendance.overtimeMinutes
            });
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
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
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
            earlyLeave: await Attendance.countDocuments({ user: userId, earlyLeaveMarks: { $gt: 0 } }),
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

// @desc    Get lifetime attendance stats for all employees (Admin)
// @route   GET /api/attendance/admin/all-stats
// @access  Private/Admin
export const getLifetimeAttendanceStats = async (req, res) => {
    try {
        const stats = await Attendance.aggregate([
            {
                $group: {
                    _id: "$user",
                    totalPresent: {
                        $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] }
                    },
                    totalLate: {
                        $sum: { $cond: [{ $eq: ["$status", "Late"] }, 1, 0] }
                    },
                    totalHalfDay: {
                        $sum: { $cond: [{ $or: [{ $eq: ["$status", "Half-Day"] }, { $eq: ["$isHalfDay", true] }] }, 1, 0] }
                    },
                    totalAbsent: {
                        $sum: { $cond: [{ $eq: ["$status", "Absent"] }, 1, 0] }
                    },
                    totalEarlyLeave: {
                        $sum: { $cond: [{ $gt: ["$earlyLeaveMarks", 0] }, 1, 0] }
                    },
                    totalOvertimeMinutes: { $sum: { $ifNull: ["$overtimeMinutes", 0] } }
                }
            }
        ]);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get employees with consecutive absences for warnings
// @route   GET /api/attendance/admin/absence-warnings
// @access  Private/Admin
export const getAbsenceWarnings = async (req, res) => {
    try {
        const employees = await User.find({ role: 'employee', status: 'Active' }).select('name erpId');
        const warnings = [];

        for (const emp of employees) {
            // Check last 10 records for this employee
            const lastAttendance = await Attendance.find({ user: emp._id })
                .sort({ date: -1 })
                .limit(10);

            let consecutiveAbsents = 0;
            for (const record of lastAttendance) {
                if (record.status === 'Absent') {
                    consecutiveAbsents++;
                } else if (record.status === 'Off') {
                    // Skip 'Off' days (weekends/holidays) if they exist in records
                    continue;
                } else {
                    // Break if they were Present or Half-Day
                    break;
                }
            }

            if (consecutiveAbsents >= 2) {
                warnings.push({
                    employee: emp,
                    consecutiveAbsents,
                    type: consecutiveAbsents >= 3 ? 'Disciplinary' : 'Warning'
                });
            }
        }

        res.json({ success: true, warnings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Export Monthly Attendance Report PDF
// @route   GET /api/attendance/export
// @access  Private
export const exportMonthlyAttendancePDF = async (req, res) => {
    try {
        const { month, year, employeeId } = req.query;
        const userId = employeeId || req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Fetch attendance records for the month
        // We need to filter by date string "YYYY-MM-..."
        const monthIndex = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ].indexOf(month);

        if (monthIndex === -1) {
            return res.status(400).json({ success: false, message: 'Invalid month' });
        }

        const startDate = new Date(year, monthIndex, 1);
        const endDate = new Date(year, monthIndex + 1, 0);

        const records = await Attendance.find({
            user: userId,
            date: {
                $gte: format(startDate, 'yyyy-MM-dd'),
                $lte: format(endDate, 'yyyy-MM-dd')
            }
        }).sort({ date: 1 });

        // Calculate stats
        const stats = {
            present: records.filter(r => r.status === 'Present').length,
            late: records.reduce((acc, curr) => acc + (curr.lateMarks || 0), 0),
            earlyLeave: records.reduce((acc, curr) => acc + (curr.earlyLeaveMarks || 0), 0),
            absent: records.filter(r => r.status === 'Absent').length,
            halfDay: records.filter(r => r.status === 'Half-Day' || r.isHalfDay).length,
            overtimeMinutes: records.reduce((acc, curr) => acc + (curr.overtimeMinutes || 0), 0)
        };

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Attendance_${user.erpId}_${month}_${year}.pdf`);

        doc.pipe(res);

        // --- PDF DESIGN ---

        // 1. Header
        doc.rect(0, 0, 612, 100).fill('#267048');
        doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text('HUNARMAND PUNJAB', 40, 30);
        doc.fontSize(10).font('Helvetica').text('Monthly Attendance Report', 40, 60);

        doc.fontSize(10).text(`Period: ${month} ${year}`, 450, 40, { align: 'right' });
        doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy')}`, 450, 55, { align: 'right' });

        doc.moveDown(4);

        // 2. Employee Info
        doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold').text('Employee Details', 40, 120);
        doc.moveTo(40, 135).lineTo(550, 135).stroke();

        doc.fontSize(10).font('Helvetica').text(`Name: ${user.name}`, 40, 145);
        doc.text(`ERP ID: ${user.erpId}`, 40, 160);
        doc.text(`Designation: ${user.title || 'N/A'}`, 300, 145);
        doc.text(`Department: ${user.department || 'N/A'}`, 300, 160);

        // 3. Stats Summary
        doc.rect(40, 185, 510, 60).fill('#f9fafb').stroke('#e5e7eb');
        doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold').text('Summary', 50, 195);

        const colW = 85;
        doc.fontSize(9).font('Helvetica');
        doc.text('Present', 50, 215);
        doc.font('Helvetica-Bold').text(stats.present.toString(), 50, 228);
        doc.font('Helvetica');

        doc.text('Late Marks', 50 + colW, 215);
        doc.text(stats.late.toString(), 50 + colW, 228);

        doc.text('Early Leaves', 50 + colW * 2, 215);
        doc.text(stats.earlyLeave.toString(), 50 + colW * 2, 228);

        doc.text('Half Days', 50 + colW * 3, 215);
        doc.text(stats.halfDay.toString(), 50 + colW * 3, 228);

        doc.text('Absents', 50 + colW * 4, 215);
        doc.text(stats.absent.toString(), 50 + colW * 4, 228);

        doc.text('Overtime', 50 + colW * 5, 215);
        doc.text(`${(stats.overtimeMinutes / 60).toFixed(1)} hrs`, 50 + colW * 5, 228);

        doc.moveDown(4);

        // 4. Attendance Table
        const tableTop = 265;
        const itemHeight = 25;

        // Table Header
        doc.rect(40, tableTop, 510, itemHeight).fill('#267048');
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
        doc.text('Date', 50, tableTop + 8);
        doc.text('Check-In', 130, tableTop + 8);
        doc.text('Check-Out', 210, tableTop + 8);
        doc.text('Status', 290, tableTop + 8);
        doc.text('Lates', 370, tableTop + 8);
        doc.text('Early L.', 430, tableTop + 8);
        doc.text('OT (Min)', 490, tableTop + 8);

        // Table Rows
        let currentY = tableTop + itemHeight;
        doc.fillColor('#000000').font('Helvetica');

        records.forEach((record, index) => {
            if (currentY + itemHeight > 750) {
                doc.addPage();
                currentY = 40;
            }

            if (index % 2 === 0) {
                doc.rect(40, currentY, 510, itemHeight).fill('#f9fafb');
            }
            doc.fillColor('#000000');
            doc.text(record.date, 50, currentY + 8);
            doc.text(record.checkIn || '--:--', 130, currentY + 8);
            doc.text(record.checkOut || '--:--', 210, currentY + 8);
            doc.text(record.status, 290, currentY + 8);
            doc.text((record.lateMarks || 0).toString(), 370, currentY + 8);
            doc.text((record.earlyLeaveMarks || 0).toString(), 430, currentY + 8);
            doc.text((record.overtimeMinutes || 0).toString(), 490, currentY + 8);

            currentY += itemHeight;
        });

        // Footer
        const footerY = 780;
        doc.fontSize(8).fillColor('#9ca3af').text('System Generated Report | Hunarmand Punjab ERP', 0, footerY, { align: 'center' });

        doc.end();

    } catch (error) {
        console.error('Attendance PDF Export Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
