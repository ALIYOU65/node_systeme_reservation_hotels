import mongoose from 'mongoose';

const reservationSchema = new mongoose.Schema({
  date_debut: { type: Date, required: true },
  date_fin: { type: Date, required: true },
  statut: { type: String, enum: ['En attente', 'Confirmée', 'Annulée', 'Payée'], default: 'En attente' },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chambre: { type: mongoose.Schema.Types.ObjectId, ref: 'Chambre', required: true },
  
  // ✅ Nouveau champ pour personnel (optionnel)
  personnel: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ✅ Paiement
  paiement: {
    status: { type: String, enum: ['pending', 'succeeded', 'failed'], default: 'pending' },
    paymentIntentId: { type: String, default: null },
    amount: { type: Number, default: 0 },
    invoiceUrl: { type: String, default: null },
  },

}, { timestamps: true });

export default mongoose.model('Reservation', reservationSchema);










// import mongoose from 'mongoose';

// const reservationSchema = new mongoose.Schema({
//   date_debut: { 
//     type: Date, 
//     required: true 
//   },
//   date_fin: { 
//     type: Date, 
//     required: true 
//   },
//   statut: { 
//     type: String, 
//     required: true, 
//     enum: ['En attente', 'Confirmée', 'Annulée', 'Expirée'], 
//     default: 'En attente' 
//   },
//   client: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'User', 
//     required: true 
//   },
//   chambre: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'Chambre', 
//     required: true 
//   },
//   personnel: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'User', 
//     required: false  
//   },
//   // Nouveau : Paiement Stripe
//   paiement: {
//     status: { 
//       type: String, 
//       enum: ['pending', 'payé', 'échoué'], 
//       default: 'pending' 
//     },
//     amount: { 
//       type: Number, 
//       required: false, 
//       default: 0 
//     },  // Fix : Optionnel au début, set plus tard
//     stripePaymentIntentId: { 
//       type: String 
//     },  // ID Stripe pour ref
//     invoiceUrl: { 
//       type: String 
//     }  // URL PDF facture générée
//   }
// }, { timestamps: true });

// // Index pour requêtes rapides sur dates et chambre (utile pour vérifier disponibilités)
// reservationSchema.index({ chambre: 1, date_debut: 1, date_fin: 1 });

// export default mongoose.model('Reservation', reservationSchema);


































