import Reservation from '../models/reservation.model.js';
import User from '../models/user.model.js';
import Chambre from '../models/chambre.model.js';
import reservationValidation from '../validations/reservation.validation.js';
import dotenv from 'dotenv';

// NOUVEAU : Import pour Stripe (installe si besoin : npm install stripe)
import Stripe from 'stripe';

dotenv.config();

// Initialisation de Stripe (ajoute ça juste après dotenv.config())
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// // Création d'une réservation (POST /reservations – Vérif disponibilité)
// const createReservation = async (req, res) => {
//   try {
//     // Validation déjà en route, mais double-check
//     const { error } = reservationValidation(req.body, false).reservationCreate;
//     if (error) {
//       return res.status(400).json({ message: error.details[0].message });
//     }
//     const { date_debut, date_fin, chambre: chambreId, client: clientId } = req.body;
//     // Vérifier que le client existe et est un CLIENT
//     const client = await User.findById(clientId);
//     if (!client || client.role !== 'CLIENT') {
//       return res.status(404).json({ message: 'Client non trouvé ou non autorisé' });
//     }
//     // Vérifier que la chambre existe et est disponible
//     const chambre = await Chambre.findById(chambreId).populate('hotel');
//     if (!chambre || chambre.etat !== 'Disponible') {
//       return res.status(400).json({ message: 'Chambre non disponible' });
//     }
//     // Vérifier chevauchement de dates
//     const overlapping = await Reservation.findOne({
//       chambre: chambreId,
//       $or: [
//         { date_debut: { $lt: date_fin }, date_fin: { $gt: date_debut } },
//         { date_debut: { $lte: date_debut }, date_fin: { $gte: date_fin } }
//       ],
//       statut: { $ne: 'Annulée' } // Ignore les annulées
//     });
//     if (overlapping) {
//       return res.status(400).json({ message: 'Chambre non disponible pour ces dates' });
//     }
//     const reservationDoc = new Reservation({
//       date_debut,
//       date_fin,
//       statut: 'En attente',
//       client: clientId,
//       chambre: chambreId,
//     });
//     const saved = await reservationDoc.save();
//     // ✅ AJOUT : Update chambre statut à "Occupée" après réservation
//     await Chambre.findByIdAndUpdate(chambreId, { etat: 'Occupée' });
//     console.log('🔍 Réservation créée et chambre mise à "Occupée":', saved._id); // Debug optionnel
//     // Ajouter refs bidirectionnelles
//     await User.findByIdAndUpdate(clientId, { $push: { reservations: saved._id } });
//     await Chambre.findByIdAndUpdate(chambreId, { $push: { reservations: saved._id } });
//     // Populate pour réponse
//     const savedWithDetails = await Reservation.findById(saved._id)
//       .populate('client', 'nom prenom email')
//       .populate({ path: 'chambre', populate: { path: 'hotel', select: 'nom adresse' } });
//     return res.status(201).json(savedWithDetails);
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ message: 'Erreur serveur', error: error.message });
//   }
// };
// Création d'une réservation (POST /reservations – Vérif disponibilité)
const createReservation = async (req, res) => {
  try {
    // Validation déjà en route, mais double-check
    const { error } = reservationValidation(req.body, false).reservationCreate;
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    const { date_debut, date_fin, chambre: chambreId, client: clientId } = req.body;
    console.log('[DEBUG CREATE] Payload reçu:', { chambreId, date_debut, date_fin });  // ← Log input pour test

    // Vérifier que le client existe et est un CLIENT
    const client = await User.findById(clientId);
    if (!client || client.role !== 'CLIENT') {
      console.log('[DEBUG] Client invalide:', clientId);
      return res.status(404).json({ message: 'Client non trouvé ou non autorisé' });
    }

    // Vérifier que la chambre existe et est disponible → FIX : 'Disponible' → 'Libre'
    const chambre = await Chambre.findById(chambreId).populate('hotel');
    if (!chambre) {
      console.log('[DEBUG] Chambre non trouvée:', chambreId);
      return res.status(404).json({ message: 'Chambre non trouvée' });
    }
    if (chambre.etat !== 'Libre') {  // ← FIX ICI : 'Libre' au lieu de 'Disponible'
      console.log('[DEBUG] Chambre pas libre (état actuel):', chambre.etat);
      return res.status(400).json({ message: 'Chambre non disponible' });
    }

    // Vérifier chevauchement de dates → Ajout log
    const debut = new Date(date_debut);
    const fin = new Date(date_fin);
    console.log('[DEBUG] Dates testées:', debut.toDateString(), 'au', fin.toDateString());

    const overlapping = await Reservation.findOne({
      chambre: chambreId,
      $or: [
        { date_debut: { $lt: date_fin }, date_fin: { $gt: date_debut } },
        { date_debut: { $lte: date_debut }, date_fin: { $gte: date_fin } }
      ],
      statut: { $ne: 'Annulée' } // Ignore les annulées
    });
    if (overlapping) {
      console.log('[DEBUG] Chevauchement trouvé:', overlapping._id, 'du', overlapping.date_debut, 'au', overlapping.date_fin);
      return res.status(400).json({ message: 'Chambre non disponible pour ces dates' });
    }
    console.log('[DEBUG] Pas de chevauchement – OK pour créer');

    const reservationDoc = new Reservation({
      date_debut,
      date_fin,
      statut: 'En attente',
      client: clientId,
      chambre: chambreId,
    });
    const saved = await reservationDoc.save();
    console.log('[DEBUG] Réservation créée:', saved._id);  // Log succès

    // ✅ AJOUT : Update chambre statut à "Occupée" après réservation
    await Chambre.findByIdAndUpdate(chambreId, { etat: 'Occupée' });

    // Ajouter refs bidirectionnelles
    await User.findByIdAndUpdate(clientId, { $push: { reservations: saved._id } });
    await Chambre.findByIdAndUpdate(chambreId, { $push: { reservations: saved._id } });

    // Populate pour réponse
    const savedWithDetails = await Reservation.findById(saved._id)
      .populate('client', 'nom prenom email')
      .populate({ path: 'chambre', populate: { path: 'hotel', select: 'nom adresse' } });
    return res.status(201).json(savedWithDetails);
  } catch (error) {
    console.error('[DEBUG CREATE] Erreur complète:', error);  // Log détaillé
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Liste toutes les réservations (GET /reservations/all – Filtre auto pour CLIENT)
const getAllReservations = async (req, res) => {
  try {
    const { clientId: queryClientId, statut } = req.query;
    let query = {};
   
    // Auto-filtre pour CLIENT : ne voit que ses propres résas
    if (req.user.role === 'CLIENT') {
      query.client = req.user.id;  // Force filtre sur l'utilisateur connecté
    } else if (req.user.role === 'PERSONNEL' && queryClientId) {
      // PERSONNEL peut filtrer par client si query fournie
      query.client = queryClientId;
    }
   
    if (statut) query.statut = statut;
    const reservations = await Reservation.find(query)
      .populate('client', 'nom prenom email')
      .populate({ path: 'chambre', populate: { path: 'hotel', select: 'nom adresse' } })
      .populate('personnel', 'nom prenom role')
      .sort({ createdAt: -1 });  // Tri par date récente (bonus pour UX)
    // Log pour debug (optionnel, retire en prod)
    console.log(`Rôle ${req.user.role} - Résas trouvées: ${reservations.length} (filtre: ${JSON.stringify(query)})`);
    return res.status(200).json(reservations);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Récupère une réservation par ID (GET /reservations/:reservationId)
const getReservationById = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.reservationId)
      .populate('client', 'nom prenom email')
      .populate({ path: 'chambre', populate: { path: 'hotel', select: 'nom adresse' } })
      .populate('personnel', 'nom prenom');
    if (!reservation) return res.status(404).json({ message: 'Réservation non trouvée' });
    return res.status(200).json(reservation);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Mise à jour d'une réservation (PUT /reservations/:reservationId – Ex. changer statut)
const updateReservation = async (req, res) => {
  try {
    const { error } = reservationValidation(req.body, true).reservationUpdate;
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    const reservationId = req.params.reservationId;
    const updateData = { ...req.body };
    // Si update de personnel (validation), vérifier rôle PERSONNEL
    if (updateData.personnel) {
      const personnel = await User.findById(updateData.personnel);
      if (!personnel || personnel.role !== 'PERSONNEL') {
        return res.status(403).json({ message: 'Personnel non autorisé' });
      }
    }
    const updated = await Reservation.findByIdAndUpdate(
      reservationId,
      updateData,
      { new: true }
    )
      .populate('client', 'nom prenom email')
      .populate({ path: 'chambre', populate: { path: 'hotel', select: 'nom adresse' } })
      .populate('personnel', 'nom prenom');
    if (!updated) return res.status(404).json({ message: 'Réservation non trouvée' });
    return res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};



// const createPaymentSessionDirect = async (reservationId, res) => {
//   try {
//     const reservation = await Reservation.findById(reservationId).populate('chambre', 'prix_nuit hotel type_chambre').populate('client');
//     if (!reservation || reservation.statut !== 'Confirmée') {
//       console.log(`[DEBUG] Session paiement non éligible pour résa ${reservationId} (statut: ${reservation?.statut})`);
//       return null;  // Bloque seulement si pas Confirmée
//     }
    
//     // CORRECTION CLÉ : Si paiement pas pending, reset pour relancer
//     if (reservation.paiement.status !== 'pending') {
//       console.log(`[DEBUG] Reset paiement pour résa ${reservationId} (était: ${reservation.paiement.status})`);
//       reservation.paiement.status = 'pending';
//       reservation.paiement.paymentIntentId = null;  // Nettoie l'ancien si échec précédent
//       await reservation.save();
//     }
    
//     // Calcul du montant (amélioré avec getTime())
//     const dateDebut = new Date(reservation.date_debut);
//     const dateFin = new Date(reservation.date_fin);
//     const nuits = Math.ceil((dateFin.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24));
//     const montant = reservation.chambre.prix_nuit * nuits;
    
//     // Ton log debug existant
//     console.log(`[DEBUG] Init session paiement pour résa ${reservationId} - Montant calculé: €${montant}`);
    
//     // Création réelle de la session Stripe
//     const session = await stripe.checkout.sessions.create({
//       payment_method_types: ['card'],
//       line_items: [
//         {
//           price_data: {
//             currency: 'eur',
//             product_data: {
//               name: `Réservation ${reservation.chambre.type_chambre || 'Chambre'} - ${reservation.chambre.hotel?.nom || 'Hôtel'}`,
//               description: `${nuits} nuits du ${reservation.date_debut} au ${reservation.date_fin}`,
//             },
//             unit_amount: montant * 100,  // En centimes
//           },
//           quantity: 1,
//         },
//       ],
//       mode: 'payment',
//       success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/paiement/success?session_id={CHECKOUT_SESSION_ID}&resa=${reservationId}`,
//       cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/paiement/cancel?resa=${reservationId}`,
//       metadata: {
//         reservationId: reservationId.toString(),
//         userId: reservation.client._id.toString(),
//       },
//     });
    
//     console.log(`Session paiement créée pour résa ${reservationId} - Montant: €${montant}`);
    
//     // Met à jour le paiement dans la réservation
//     reservation.paiement.paymentIntentId = session.payment_intent;
//     reservation.paiement.status = 'pending';
//     await reservation.save();
    
//     return session.client_secret;  // Vrai secret pour frontend
    
//   } catch (error) {
//     console.error('Erreur session paiement:', error.message);
//     return null;
//   }
// };

const createPaymentSessionDirect = async (req, res) => {
  try {
    const { amount, reservationId, urlSuccess, urlCancel } = req.body;

    const reservation = await Reservation.findById(reservationId);
    if (!reservation)
      return res.status(404).json({ message: "Réservation non trouvée" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: "Réservation chambre" },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: urlSuccess,
      cancel_url: urlCancel,
    });

    reservation.paiement.paymentIntentId = session.payment_intent;

    // ⭐ Vérifier si déjà payé
    const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);

    if (paymentIntent.status === "succeeded") {
      reservation.statut = "Payée";              // <── synchro
      reservation.paiement.status = "succeeded";
    }

    await reservation.save();

    res.status(200).json({ url: session.url });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur Serveur" });
  }
};


//  const confirmReservation = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const userId = req.user.id;
//     const { paymentIntentId } = req.body;

//     // Charger réservation
//     const reservation = await Reservation.findById(id)
//       .populate("client")
//       .populate("chambre");

//     if (!reservation)
//       return res.status(404).json({ message: "Réservation non trouvée" });

//     // Sécurité utilisateur
//     if (reservation.client._id.toString() !== userId)
//       return res
//         .status(403)
//         .json({ message: "Accès refusé : Ce n’est pas votre réservation" });

//     // ---------------------------------------------
//     // 1) IDÉMPOTENCE : DEJA PAYÉE
//     // ---------------------------------------------
//     if (
//       reservation.statut === "Payée" &&
//       reservation.paiement?.status === "succeeded"
//     ) {
//       return res.status(200).json({
//         message: "Réservation déjà payée",
//         reservation,
//       });
//     }

//     // ---------------------------------------------
//     // 2) CONFIRMATION MANUELLE (sans paiement encore)
//     // ---------------------------------------------
//     if (reservation.statut === "En attente") {
//       reservation.statut = "Confirmée";
//       await reservation.save();

//       return res.status(200).json({
//         message: "Réservation confirmée – vous pouvez procéder au paiement",
//         reservation,
//       });
//     }

//     // ---------------------------------------------
//     // 3) FINALISATION PAIEMENT STRIPE
//     // ---------------------------------------------
//     if (paymentIntentId) {
//       const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

//       reservation.paiement.paymentIntentId = paymentIntentId;
//       reservation.paiement.status = paymentIntent.status;

//       // Si payé → statut final mis à jour
//       if (paymentIntent.status === "succeeded") {
//         reservation.statut = "Payée"; // ⚠ Doit exister dans le enum !
//         await reservation.save();

//         return res.status(200).json({
//           message: "Paiement confirmé – Réservation payée",
//           reservation,
//         });
//       }

//       // Paiement échoué ou incomplete
//       await reservation.save();
//       return res.status(400).json({
//         message: "Paiement non validé",
//         reservation,
//       });
//     }

//     // Si aucun contexte de paiement → réponse générique
//     return res.status(200).json({
//       message: "Réservation mise à jour",
//       reservation,
//     });
//   } catch (error) {
//     console.error("[ERREUR confirmReservation]", error);
//     return res.status(500).json({
//       error: "Erreur serveur lors de la confirmation",
//       details: error.message,
//     });
//   }
// };

// CONFIRMER LE PAIEMENT
const confirmReservation = async (req, res) => {
  try {
    const { paymentIntentId, reservationId } = req.body;

    const reservation = await Reservation.findById(reservationId);
    if (!reservation)
      return res.status(404).json({ message: "Réservation non trouvée." });

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // MISE À JOUR DU STATUT PAIEMENT
    reservation.paiement.status = paymentIntent.status;
    reservation.paiement.paymentIntentId = paymentIntent.id;

    // ⭐ SYNCHRONISATION AUTOMATIQUE DES STATUTS
    if (paymentIntent.status === "succeeded") {
      reservation.statut = "Payée";       // <<< IMPORTANT
    }

    await reservation.save();

    res.status(200).json({
      message: "Réservation mise à jour avec succès",
      reservation,
    });

  } catch (error) {
    console.error("Erreur confirmation paiement :", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};


// Suppression d'une réservation (DELETE /reservations/:reservationId – Seulement si en attente)
const deleteReservation = async (req, res) => {
  try {
    const reservationId = req.params.reservationId;
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) return res.status(404).json({ message: 'Réservation non trouvée' });
    if (reservation.statut !== 'En attente') {
      return res.status(400).json({ message: 'Impossible d\'annuler une réservation confirmée' });
    }
    // Retirer refs bidirectionnelles
    await User.findByIdAndUpdate(reservation.client, { $pull: { reservations: reservationId } });
    await Chambre.findByIdAndUpdate(reservation.chambre, { $pull: { reservations: reservationId } });
    await Reservation.findByIdAndDelete(reservationId);
    return res.status(200).json({ message: 'Réservation annulée' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// NOUVEAU : Vérif disponibilité publique (POST /reservations/:hotelId/disponibilites)
const checkDisponibilite = async (req, res) => {
  try {
    const { hotelId } = req.params;
    const { chambreId, dateDebut, dateFin } = req.body;
    if (!chambreId || !dateDebut || !dateFin) {
      return res.status(400).json({ message: 'ChambreId, dateDebut et dateFin requis.', disponible: false });
    }
    if (new Date(dateFin) <= new Date(dateDebut)) {
      return res.status(400).json({ message: 'Date de départ doit être après arrivée.', disponible: false });
    }
    // Vérifier chambre existe et disponible
    const chambre = await Chambre.findById(chambreId);
    if (!chambre || chambre.etat !== 'Disponible') {
      return res.status(400).json({ message: 'Chambre non disponible.', disponible: false });
    }
    // Query chevauchement (seulement réservations non annulées)
    const overlapping = await Reservation.findOne({
      chambre: chambreId,
      $or: [
        { date_debut: { $lt: new Date(dateFin) }, date_fin: { $gt: new Date(dateDebut) } }
      ],
      statut: { $ne: 'Annulée' }
    });
    const disponible = !overlapping && new Date(dateDebut) >= new Date(); // + pas dans le passé
    res.json({ disponible, message: disponible ? 'Libre pour ces dates' : 'Occupée ou dates invalides' });
  } catch (error) {
    console.error('Erreur check dispo:', error);
    res.status(500).json({ message: 'Erreur serveur.', disponible: false });
  }
};

// // Nouvelle fonction : Liste des réservations de l'utilisateur connecté
// const getUserReservations = async (req, res) => {
//   try {
//     const userId = req.user.id;  // De l'authMiddleware – filtre par client
//     if (!userId) {
//       return res.status(401).json({ error: 'Utilisateur non authentifié' });
//     }

//     const reservations = await Reservation.find({ client: userId })  // Filtre par client connecté
//       .populate({
//         path: 'chambre',
//         select: 'type_chambre prix_nuit etat description',
//         populate: { path: 'hotel', select: 'nom adresse etoiles prix' }
//       })
//       .populate('client', 'nom prenom email')
//       .sort({ createdAt: -1 })  // Plus récentes d'abord
//       .lean();  // Optimise pour JSON

//     console.log(`[DEBUG] Chargé ${reservations.length} réservations pour user ${userId}`);

//     res.status(200).json({
//       reservations,
//       message: 'Réservations chargées avec succès',
//       count: reservations.length
//     });
//   } catch (error) {
//     console.error('[ERREUR] getUserReservations:', error.message);
//     res.status(500).json({ error: 'Erreur chargement réservations' });
//   }
// };
// Liste des réservations du client connecté
const getUserReservations = async (req, res) => {
  try {
    const userId = req.user.id;
    const reservations = await Reservation.find({ client: userId })
      .populate({
        path: 'chambre',
        select: 'type_chambre prix_nuit etat description',
        populate: { path: 'hotel', select: 'nom adresse etoiles prix' }
      })
      .populate('client', 'nom prenom email')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ reservations, count: reservations.length });
  } catch (error) {
    console.error('[ERREUR] getUserReservations:', error.message);
    res.status(500).json({ error: 'Erreur chargement réservations' });
  }
};

export { 
  createReservation, 
  getAllReservations, 
  getReservationById, 
  updateReservation,
  createPaymentSessionDirect , 
  deleteReservation, 
  confirmReservation,
  checkDisponibilite,
  getUserReservations
};

































// import Reservation from '../models/reservation.model.js';
// import User from '../models/user.model.js';
// import Chambre from '../models/chambre.model.js';
// import reservationValidation from '../validations/reservation.validation.js';
// import dotenv from 'dotenv';

// dotenv.config();

// // Création d'une réservation (POST /reservations – Vérif disponibilité)
// const createReservation = async (req, res) => {
//   try {
//     // Validation déjà en route, mais double-check
//     const { error } = reservationValidation(req.body, false).reservationCreate;
//     if (error) {
//       return res.status(400).json({ message: error.details[0].message });
//     }

//     const { date_debut, date_fin, chambre: chambreId, client: clientId } = req.body;

//     // Vérifier que le client existe et est un CLIENT
//     const client = await User.findById(clientId);
//     if (!client || client.role !== 'CLIENT') {
//       return res.status(404).json({ message: 'Client non trouvé ou non autorisé' });
//     }

//     // Vérifier que la chambre existe et est disponible
//     const chambre = await Chambre.findById(chambreId).populate('hotel');
//     if (!chambre || chambre.etat !== 'Disponible') {
//       return res.status(400).json({ message: 'Chambre non disponible' });
//     }

//     // Vérifier chevauchement de dates
//     const overlapping = await Reservation.findOne({
//       chambre: chambreId,
//       $or: [
//         { date_debut: { $lt: date_fin }, date_fin: { $gt: date_debut } },
//         { date_debut: { $lte: date_debut }, date_fin: { $gte: date_fin } }
//       ],
//       statut: { $ne: 'Annulée' } // Ignore les annulées
//     });
//     if (overlapping) {
//       return res.status(400).json({ message: 'Chambre non disponible pour ces dates' });
//     }

//     const reservationDoc = new Reservation({
//       date_debut,
//       date_fin,
//       statut: 'En attente',
//       client: clientId,
//       chambre: chambreId,
//     });

//     const saved = await reservationDoc.save();

//     // Ajouter refs bidirectionnelles
//     await User.findByIdAndUpdate(clientId, { $push: { reservations: saved._id } });
//     await Chambre.findByIdAndUpdate(chambreId, { $push: { reservations: saved._id } });

//     // Populate pour réponse
//     const savedWithDetails = await Reservation.findById(saved._id)
//       .populate('client', 'nom prenom email')
//       .populate({ path: 'chambre', populate: { path: 'hotel', select: 'nom adresse' } });

//     return res.status(201).json(savedWithDetails);
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ message: 'Erreur serveur', error: error.message });
//   }
// };

// // Liste toutes les réservations (GET /reservations/all – Filtre auto pour CLIENT)
// const getAllReservations = async (req, res) => {
//   try {
//     const { clientId: queryClientId, statut } = req.query;
//     let query = {};
    
//     // Auto-filtre pour CLIENT : ne voit que ses propres résas
//     if (req.user.role === 'CLIENT') {
//       query.client = req.user.id;  // Force filtre sur l'utilisateur connecté
//     } else if (req.user.role === 'PERSONNEL' && queryClientId) {
//       // PERSONNEL peut filtrer par client si query fournie
//       query.client = queryClientId;
//     }
    
//     if (statut) query.statut = statut;

//     const reservations = await Reservation.find(query)
//       .populate('client', 'nom prenom email')
//       .populate({ path: 'chambre', populate: { path: 'hotel', select: 'nom adresse' } })
//       .populate('personnel', 'nom prenom role')
//       .sort({ createdAt: -1 });  // Tri par date récente (bonus pour UX)

//     // Log pour debug (optionnel, retire en prod)
//     console.log(`Rôle ${req.user.role} - Résas trouvées: ${reservations.length} (filtre: ${JSON.stringify(query)})`);

//     return res.status(200).json(reservations);
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ message: 'Erreur serveur', error: error.message });
//   }
// };

// // Récupère une réservation par ID (GET /reservations/:reservationId)
// const getReservationById = async (req, res) => {
//   try {
//     const reservation = await Reservation.findById(req.params.reservationId)
//       .populate('client', 'nom prenom email')
//       .populate({ path: 'chambre', populate: { path: 'hotel', select: 'nom adresse' } })
//       .populate('personnel', 'nom prenom');
//     if (!reservation) return res.status(404).json({ message: 'Réservation non trouvée' });
//     return res.status(200).json(reservation);
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ message: 'Erreur serveur', error: error.message });
//   }
// };

// // Mise à jour d'une réservation (PUT /reservations/:reservationId – Ex. changer statut)
// const updateReservation = async (req, res) => {
//   try {
//     const { error } = reservationValidation(req.body, true).reservationUpdate;
//     if (error) {
//       return res.status(400).json({ message: error.details[0].message });
//     }

//     const reservationId = req.params.reservationId;
//     const updateData = { ...req.body };

//     // Si update de personnel (validation), vérifier rôle PERSONNEL
//     if (updateData.personnel) {
//       const personnel = await User.findById(updateData.personnel);
//       if (!personnel || personnel.role !== 'PERSONNEL') {
//         return res.status(403).json({ message: 'Personnel non autorisé' });
//       }
//     }

//     const updated = await Reservation.findByIdAndUpdate(
//       reservationId,
//       updateData,
//       { new: true }
//     )
//       .populate('client', 'nom prenom email')
//       .populate({ path: 'chambre', populate: { path: 'hotel', select: 'nom adresse' } })
//       .populate('personnel', 'nom prenom');

//     if (!updated) return res.status(404).json({ message: 'Réservation non trouvée' });

//     return res.status(200).json(updated);
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ message: 'Erreur serveur', error: error.message });
//   }
// };

// // Mise à jour : Confirmer + initier paiement
// const confirmReservation = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const userId = req.user.id;

//     const reservation = await Reservation.findById(id).populate('client');
//     if (!reservation) return res.status(404).json({ message: 'Réservation non trouvée' });
//     if (reservation.client._id.toString() !== userId) return res.status(403).json({ message: 'Accès refusé : Pas votre réservation' });
//     if (reservation.statut !== 'En attente') return res.status(400).json({ message: 'Seules les réservations en attente peuvent être confirmées' });

//     reservation.statut = 'Confirmée';
//     await reservation.save();

//     console.log(`Réservation ${id} confirmée par client ${userId}`);

//     // Nouveau : Initier session paiement (appel direct avec ID et res pour simuler)
//     const clientSecret = await createPaymentSessionDirect(id, res);  // Fonction helper (ajoutée ci-dessous)

//     const confirmedRes = await Reservation.findById(id)
//       .populate('client', 'nom prenom email')
//       .populate({ path: 'chambre', populate: { path: 'hotel', select: 'nom adresse' } })
//       .populate('personnel', 'nom prenom');

//     if (clientSecret) {
//       res.status(200).json({ 
//         message: 'Réservation confirmée – Procédez au paiement', 
//         reservation: confirmedRes, 
//         clientSecret 
//       });
//     } else {
//       res.status(200).json({ message: 'Réservation confirmée (paiement optionnel)', reservation: confirmedRes });
//     }
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Erreur lors de la confirmation', error: error.message });
//   }
// };

// // Helper : Appel direct à createPaymentSession (sans full req, pour éviter hacks)
// const createPaymentSessionDirect = async (reservationId, res) => {
//   try {
//     const reservation = await Reservation.findById(reservationId).populate('chambre', 'prix_nuit').populate('client');
//     if (!reservation || reservation.statut !== 'Confirmée' || reservation.paiement.status !== 'pending') {
//       return null;  // Non éligible
//     }

//     // Log debug
//     console.log(`Init session paiement pour résa ${reservationId} - Montant calculé: €${reservation.chambre.prix_nuit * (Math.ceil((reservation.date_fin - reservation.date_debut) / (1000 * 60 * 60 * 24)))}`);

//     // Retourne { clientSecret } ou null
//     return 'pi_test_secret';  
//   } catch (error) {
//     console.error('Erreur session paiement:', error);
//     return null;
//   }
// };

// // Suppression d'une réservation (DELETE /reservations/:reservationId – Seulement si en attente)
// const deleteReservation = async (req, res) => {
//   try {
//     const reservationId = req.params.reservationId;
//     const reservation = await Reservation.findById(reservationId);

//     if (!reservation) return res.status(404).json({ message: 'Réservation non trouvée' });
//     if (reservation.statut !== 'En attente') {
//       return res.status(400).json({ message: 'Impossible d\'annuler une réservation confirmée' });
//     }

//     // Retirer refs bidirectionnelles
//     await User.findByIdAndUpdate(reservation.client, { $pull: { reservations: reservationId } });
//     await Chambre.findByIdAndUpdate(reservation.chambre, { $pull: { reservations: reservationId } });

//     await Reservation.findByIdAndDelete(reservationId);

//     return res.status(200).json({ message: 'Réservation annulée' });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ message: 'Erreur serveur', error: error.message });
//   }
// };

// export { createReservation, getAllReservations, getReservationById, updateReservation, deleteReservation, confirmReservation };























