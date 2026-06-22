import mongoose from 'mongoose';

const chambreSchema = new mongoose.Schema({
  type_chambre: { 
    type: String, 
    required: true, 
    enum: ['Simple', 'Double', 'Suite'] 
  },
  capacite: { 
    type: Number, 
    required: true, 
    min: 1 
  },
  prix_nuit: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  etat: { 
    type: String, 
    required: true, 
    enum: ['Libre', 'Occupée'], 
    default: 'Libre' 
  },
  description: { 
    type: String, 
    required: false 
  },
  hotel: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Hotel', 
    required: true 
  },
  reservations: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Reservation',
     required: false
  }],
  photos: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ChambrePhoto' 
  }] 
}, { timestamps: true });

export default mongoose.model('Chambre', chambreSchema);