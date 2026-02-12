import cloudinary from '../utils/cloudinary.js';
import fs from 'fs';

// @desc    Upload image to Cloudinary
// @route   POST /api/upload
// @access  Private/Admin
export const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Upload directly from buffer/path (assuming using diskStorage or similar, but with multer memoryStorage we use stream or just write to temp)
        // Since we didn't specify storage engine yet, let's assume default (memory) or temp file.
        // Best practice for simple setup: use diskStorage to temp folder then upload.

        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'hunarmand_employees',
            resource_type: 'image'
        });

        // Cleanup local file
        fs.unlinkSync(req.file.path);

        res.status(200).json({
            success: true,
            message: 'Image uploaded successfully',
            imageUrl: result.secure_url,
            publicId: result.public_id
        });

    } catch (error) {
        // Cleanup if file exists but upload failed
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, message: 'Image upload failed: ' + error.message });
    }
};
