import mongoose from 'mongoose';

const avisSchema = new mongoose.Schema({
  hotel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  user: {  
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true  
  },
  note: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  commentaire: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'  
  }
}, {
  timestamps: true
});

export default mongoose.model('Avis', avisSchema);

























