import Reservation from '../models/reservation.model.js';
import User from '../models/user.model.js';
import Chambre from '../models/chambre.model.js';
import reservationValidation from '../validations/reservation.validation.js';
import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Création d'une réservation (POST /reservations – Vérif disponibilité)
  const createReservation = async (req, res) => {
  try {
    // Validation déjà en route, mais double-check
    const { error } = reservationValidation(req.body, false).reservationCreate;
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    const { date_debut, date_fin, chambre: chambreId, client: clientId } = req.body;
    console.log('[DEBUG CREATE] Payload reçu:', { chambreId, date_debut, date_fin });  

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
    if (chambre.etat !== 'Libre') {  
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
      statut: { $ne: 'Annulée' } 
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
    console.log('[DEBUG] Réservation créée:', saved._id); 

    // Update chambre statut à "Occupée" après réservation
    await Chambre.findByIdAndUpdate(chambreId, { etat: 'Occupée' });

    await User.findByIdAndUpdate(clientId, { $push: { reservations: saved._id } });
    await Chambre.findByIdAndUpdate(chambreId, { $push: { reservations: saved._id } });

    const savedWithDetails = await Reservation.findById(saved._id)
      .populate('client', 'nom prenom email')
      .populate({ path: 'chambre', populate: { path: 'hotel', select: 'nom adresse' } });
    return res.status(201).json(savedWithDetails);
  } catch (error) {
    console.error('[DEBUG CREATE] Erreur complète:', error);  
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Liste toutes les réservations (GET /reservations/all – Filtre auto pour CLIENT)
const getAllReservations = async (req, res) => {
  try {
    const { clientId: queryClientId, statut } = req.query;
    let query = {};
   
    // Auto-filtre pour CLIENT : ne voit que ses propres réservations
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

    // Vérifier si déjà payé
    const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);

    if (paymentIntent.status === "succeeded") {
      reservation.statut = "Payée";             
      reservation.paiement.status = "succeeded";
    }

    await reservation.save();

    res.status(200).json({ url: session.url });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur Serveur" });
  }
};

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

    // SYNCHRONISATION AUTOMATIQUE DES STATUTS
    if (paymentIntent.status === "succeeded") {
      reservation.statut = "Payée";       
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
    await User.findByIdAndUpdate(reservation.client, { $pull: { reservations: reservationId } });
    await Chambre.findByIdAndUpdate(reservation.chambre, { $pull: { reservations: reservationId } });
    await Reservation.findByIdAndDelete(reservationId);
    return res.status(200).json({ message: 'Réservation annulée' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Vérif disponibilité publique (POST /reservations/:hotelId/disponibilites)
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

export { createReservation, getAllReservations, getReservationById, updateReservation, createPaymentSessionDirect , deleteReservation, 
  confirmReservation, checkDisponibilite, getUserReservations };
































