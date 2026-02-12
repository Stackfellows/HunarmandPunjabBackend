import User from '../Models/auth.js';
import jwt from 'jsonwebtoken';

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
    let { cnic, password } = req.body;
    cnic = cnic?.trim();
    password = password?.trim();

    console.log('[DEBUG] Login request received for CNIC:', cnic);

    try {
        const user = await User.findOne({ cnic });
        console.log('[DEBUG] User lookup:', user ? `Found: ${user.name} (${user.role})` : 'NOT FOUND');

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid CNIC or password' });
        }

        const isMatch = await user.matchPassword(password);
        console.log('[DEBUG] Password match:', isMatch);

        if (isMatch) {
            const userResponse = user.toObject();
            delete userResponse.password;

            res.json({
                success: true,
                user: userResponse,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid CNIC or password' });
        }
    } catch (error) {
        console.error('[DEBUG] Authentication error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (user) {
            res.json({
                success: true,
                user
            });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
