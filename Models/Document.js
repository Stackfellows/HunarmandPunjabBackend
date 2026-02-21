import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
    title: { type: String, required: true }, // e.g., "Warning Letter", "Experience Certificate"
    subject: { type: String, required: true },
    recipientName: { type: String, required: true },
    recipientEmail: { type: String },
    content: { type: String, required: true }, // HTML content
    type: { type: String, default: 'General' },
    refNumber: { type: String }, // e.g., HP/2026/054
    generatedPdfPath: { type: String }, // Optional path if stored
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

const Document = mongoose.model('Document', documentSchema);

export default Document;
