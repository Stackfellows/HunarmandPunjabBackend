import mongoose from 'mongoose';

const workProgressSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userName: String,
    task: {
        type: String,
        required: true
    },
    date: {
        type: String,
        default: () => new Date().toLocaleDateString('en-GB')
    }
}, { timestamps: true });

const WorkProgress = mongoose.model('WorkProgress', workProgressSchema);
export default WorkProgress;
