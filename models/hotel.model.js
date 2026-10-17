import mongoose from 'mongoose';

const hotelSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true
  },
  adresse: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  prix: {
    type: Number,
    required: true
  },
  etoiles: {  
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  personnel: {  
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  chambres: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chambre'
  }],
  photos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Photo'
  }],
  avis: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Avis'
  }],
  // État de validation
  validated: {
    type: Boolean,
    default: false  
  },
  // Qui a validé (ref vers User rôle MODERATEUR), et quand
  validatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  validatedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

export default mongoose.model('Hotel', hotelSchema);





















