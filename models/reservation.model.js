import mongoose from 'mongoose';

const reservationSchema = new mongoose.Schema({
  date_debut: { type: Date, required: true },
  date_fin: { type: Date, required: true },
  statut: { type: String, enum: ['En attente', 'Confirmée', 'Annulée', 'Payée'], default: 'En attente' },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chambre: { type: mongoose.Schema.Types.ObjectId, ref: 'Chambre', required: true },
  
  personnel: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  paiement: {
    status: { type: String, enum: ['pending', 'succeeded', 'failed'], default: 'pending' },
    paymentIntentId: { type: String, default: null },
    amount: { type: Number, default: 0 },
    invoiceUrl: { type: String, default: null },
  },

}, { timestamps: true });

export default mongoose.model('Reservation', reservationSchema);









































