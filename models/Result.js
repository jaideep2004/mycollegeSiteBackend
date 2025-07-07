const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    semester: {
        type: String,
        required: true
    },
    marks: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    grade: {
        type: String,
        enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'],
        required: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Add index for faster queries
resultSchema.index({ studentId: 1, courseId: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('Result', resultSchema);