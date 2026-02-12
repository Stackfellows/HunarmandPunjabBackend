import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // null means assigned to "All"
    },
    description: {
        type: String,
        required: true
    },
    date: {
        type: String,
        required: true,
        default: () => new Date().toISOString().split('T')[0]
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed'],
        default: 'Pending'
    }
}, { timestamps: true });

const Task = mongoose.model('Task', taskSchema);
export default Task;
