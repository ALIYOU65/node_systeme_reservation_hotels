import { Router } from 'express';
import express from 'express';

import { 
  createReservation, 
  getAllReservations, 
  getReservationById, 
  updateReservation, 
  deleteReservation, 
  confirmReservation, 
  checkDisponibilite, 
  getUserReservations 
} from '../controllers/reservation.controller.js';

import { 
  createPaymentSession, 
  handleStripeWebhook, 
  getMesFactures, 
  downloadFacture,
  getPaymentStatus // <-- Import du nouveau controller
} from '../controllers/payment.controller.js';

import reservationValidation from '../validations/reservation.validation.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { rolesMiddleware } from '../middlewares/rolesMiddleware.js';

import Reservation from '../models/reservation.model.js';

const router = Router();

/* ================================================================
   🔵 1 — ROUTES FIXES (SANS PARAMÈTRES DYNAMIQUES)
   Très important : elles doivent toujours être AVANT toute route
   contenant :id, sinon elles seront bloquées.
================================================================ */

// 1. Liste des factures du client
router.get(
  '/factures',
  authMiddleware,
  rolesMiddleware(['CLIENT']),
  getMesFactures
);

// 2. Télécharger une facture (ID de la réservation)
router.get(
  '/:id/facture/download',
  authMiddleware,
  rolesMiddleware(['CLIENT']),
  downloadFacture
);

// 3. Webhook Stripe — doit être AVANT express.json()
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    try {
      handleStripeWebhook(req, res);
    } catch (err) {
      console.error('Webhook Stripe error:', err);
      res.status(400).send('Webhook error');
    }
  }
);

/* ================================================================
   🟢 2 — ROUTES SANS RISQUE DE CONFLIT AVEC /:id
================================================================ */

// Créer réservation
router.post(
  '/',
  authMiddleware,
  rolesMiddleware(['CLIENT']),
  (req, res, next) => {
    if (!req.body.client) req.body.client = req.user.id;

    const { error } = reservationValidation(req.body, false).reservationCreate;
    if (error) return res.status(400).json({ message: error.details[0].message });

    next();
  },
  createReservation
);

// Mes réservations
router.get(
  '/',
  authMiddleware,
  rolesMiddleware(['CLIENT']),
  getUserReservations
);

// Réservations d'une chambre (pas de conflit car chemin spécifique)
router.get(
  '/chambre/:id',
  authMiddleware,
  rolesMiddleware(['CLIENT']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const reservations = await Reservation.find({ chambre: id })
        .populate('chambre', 'type_chambre prix_nuit')
        .sort({ date_debut: 1 });

      console.log(`[DEBUG] Résas pour chambre ${id}: ${reservations.length}`);

      res.json(reservations);
    } catch (err) {
      console.error('[DEBUG] Erreur GET résas par chambre:', err);
      res.status(500).json({ message: 'Erreur fetch réservations' });
    }
  }
);

// Vérification disponibilités
router.post('/:hotelId/disponibilites', checkDisponibilite);

// Récupérer toutes les réservations (admin + personnel)
router.get(
  '/all',
  authMiddleware,
  rolesMiddleware(['CLIENT', 'PERSONNEL']),
  getAllReservations
);

/* ================================================================
   🔴 3 — ROUTE PAYMENT-STATUS (À METTRE AVANT /:reservationId)
   Sinon Express confondra "payment-status" avec un ID.
================================================================ */

router.get(
  '/:id/payment-status',
  authMiddleware,
  rolesMiddleware(['CLIENT']),
  getPaymentStatus
);

/* ================================================================
   🟣 4 — ROUTES AVEC PARAMÈTRES DYNAMIQUES :id
   À placer en dernier, sinon elles BLOQUENT toutes les routes.
================================================================ */

// Récupérer une réservation
router.get(
  '/:reservationId',
  authMiddleware,
  rolesMiddleware(['CLIENT', 'PERSONNEL']),
  getReservationById
);

// Mise à jour d’une réservation
router.put(
  '/:reservationId',
  authMiddleware,
  rolesMiddleware(['PERSONNEL']),
  (req, res, next) => {
    const { error } = reservationValidation(req.body, true).reservationUpdate;
    if (error) return res.status(400).json({ message: error.details[0].message });
    next();
  },
  updateReservation
);

// Confirmer une réservation (client)
router.put(
  '/:id/confirm',
  authMiddleware,
  rolesMiddleware(['CLIENT']),
  confirmReservation
);

// Créer session de paiement
router.post(
  '/:reservationId/payment',
  authMiddleware,
  rolesMiddleware(['CLIENT']),
  createPaymentSession
);

// Supprimer une réservation
router.delete(
  '/:reservationId',
  authMiddleware,
  rolesMiddleware(['CLIENT', 'PERSONNEL']),
  deleteReservation
);

export default router;
















// import { Router } from 'express';
// import express from 'express';
// import { 
//   createReservation, 
//   getAllReservations, 
//   getReservationById, 
//   updateReservation, 
//   deleteReservation, 
//   confirmReservation, 
//   checkDisponibilite, 
//   getUserReservations 
// } from '../controllers/reservation.controller.js';
// import { 
//   createPaymentSession, 
//   handleStripeWebhook, 
//   getMesFactures, 
//   downloadFacture, getPaymentStatus  
// } from '../controllers/payment.controller.js';
// import reservationValidation from '../validations/reservation.validation.js';
// import authMiddleware from '../middlewares/authMiddleware.js';
// import { rolesMiddleware } from '../middlewares/rolesMiddleware.js';
// import Reservation from '../models/reservation.model.js';

// const router = Router();

// // ==================== ROUTES FIXES (À METTRE EN PREMIER !!) ====================
// // 1. MES FACTURES (DOIT ÊTRE AVANT TOUTES LES ROUTES AVEC :id)
// router.get('/factures', authMiddleware, rolesMiddleware(['CLIENT']), getMesFactures);

// // 2. Téléchargement facture
// router.get('/:id/facture/download', authMiddleware, rolesMiddleware(['CLIENT']), downloadFacture);

// // 3. Webhook Stripe
// router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
//   try {
//     handleStripeWebhook(req, res);
//   } catch (err) {
//     console.error('Webhook Stripe error:', err);
//     res.status(400).send('Webhook error');
//   }
// });

// // ==================== ROUTES AVEC PARAMÈTRES (APRÈS LES FIXES) ====================
// router.post('/', authMiddleware, rolesMiddleware(['CLIENT']), (req, res, next) => {
//   if (!req.body.client) req.body.client = req.user.id;
//   const { error } = reservationValidation(req.body, false).reservationCreate;
//   if (error) return res.status(400).json({ message: error.details[0].message });
//   next();
// }, createReservation);

// router.get('/', authMiddleware, rolesMiddleware(['CLIENT']), getUserReservations);

// router.get('/chambre/:id', authMiddleware, rolesMiddleware(['CLIENT']), async (req, res) => {
//   try {
//     const { id } = req.params;
//     const reservations = await Reservation.find({ chambre: id })
//       .populate('chambre', 'type_chambre prix_nuit')
//       .sort({ date_debut: 1 });
//     console.log(`[DEBUG] Résas pour chambre ${id}: ${reservations.length}`);
//     res.json(reservations);
//   } catch (err) {
//     console.error('[DEBUG] Erreur GET résas par chambre:', err);
//     res.status(500).json({ message: 'Erreur fetch réservations' });
//   }
// });

// router.post('/:hotelId/disponibilites', checkDisponibilite);

// router.get('/all', authMiddleware, rolesMiddleware(['CLIENT', 'PERSONNEL']), getAllReservations);

// router.get('/:id/payment-status', authMiddleware, rolesMiddleware(['CLIENT']), getPaymentStatus);
// router.get('/:reservationId', authMiddleware, rolesMiddleware(['CLIENT', 'PERSONNEL']), getReservationById);


// // router.get('/:id/payment-status', authMiddleware, rolesMiddleware(['CLIENT']), async (req, res) => {
// //   // ... ton code payment-status
// // });
// router.put('/:reservationId', authMiddleware, rolesMiddleware(['PERSONNEL']), (req, res, next) => {
//   const { error } = reservationValidation(req.body, true).reservationUpdate;
//   if (error) return res.status(400).json({ message: error.details[0].message });
//   next();
// }, updateReservation);

// router.put('/:id/confirm', authMiddleware, rolesMiddleware(['CLIENT']), confirmReservation);
// router.post('/:reservationId/payment', authMiddleware, rolesMiddleware(['CLIENT']), createPaymentSession);

// router.delete('/:reservationId', authMiddleware, rolesMiddleware(['CLIENT', 'PERSONNEL']), deleteReservation);

// export default router;
































// import { Router } from 'express';
// import express from 'express';  // Ajout : Pour express.raw (body brut pour webhook)
// import { createReservation, getAllReservations, getReservationById, updateReservation, deleteReservation, confirmReservation, checkDisponibilite, getUserReservations } from '../controllers/reservation.controller.js';
// import { createPaymentSession, handleStripeWebhook } from '../controllers/payment.controller.js';
// import reservationValidation from '../validations/reservation.validation.js';
// import authMiddleware from '../middlewares/authMiddleware.js';
// import { rolesMiddleware } from '../middlewares/rolesMiddleware.js';
// import Reservation from '../models/reservation.model.js';

// const router = Router();

// // Création d'une réservation (seulement CLIENT, validation en middleware)
// router.post('/', authMiddleware, rolesMiddleware(['CLIENT']), (req, res, next) => {
//   if (!req.body.client) req.body.client = req.user.id;
//   const { error } = reservationValidation(req.body, false).reservationCreate;
//   if (error) return res.status(400).json({ message: error.details[0].message });
//   next();
// }, createReservation);

// // ← NOUVEAU : Route GET pour fetch réservations utilisateur (résout 404 frontend)
// router.get('/', authMiddleware, rolesMiddleware(['CLIENT']), getUserReservations);

// // ← NOUVEAU : Route GET pour fetch réservations par chambre (résout 404 frontend)
// router.get('/chambre/:id', authMiddleware, rolesMiddleware(['CLIENT']), async (req, res) => {
//   try {
//     const { id } = req.params;
//     const reservations = await Reservation.find({ chambre: id })
//       .populate('chambre', 'type_chambre prix_nuit')  // Optionnel : Infos chambre
//       .sort({ date_debut: 1 });  // Trie par date
//     console.log(`[DEBUG] Résas pour chambre ${id}: ${reservations.length}`);  // Log pour vérifier
//     res.json(reservations);
//   } catch (err) {
//     console.error('[DEBUG] Erreur GET résas par chambre:', err);
//     res.status(500).json({ message: 'Erreur fetch réservations' });
//   }
// });

// // Route PUBLIQUE : Vérif disponibilité
// router.post('/:hotelId/disponibilites', checkDisponibilite);

// // Liste des réservations
// router.get('/all', authMiddleware, rolesMiddleware(['CLIENT', 'PERSONNEL']), getAllReservations);

// // Récupère une réservation par ID
// router.get('/:reservationId', authMiddleware, rolesMiddleware(['CLIENT', 'PERSONNEL']), getReservationById);

// // ⭐ PAYEMENT STATUS (corrigé mais structure identique)
// router.get('/:id/payment-status', authMiddleware, rolesMiddleware(['CLIENT']), async (req, res) => {
//   try {
//     const { id } = req.params;
//     const reservation = await Reservation
//       .findById(id)
//       .populate('chambre.hotel client');
//     if (!reservation) {
//       return res.status(404).json({ message: 'Réservation non trouvée' });
//     }
//     // Vérification que c'est bien la réservation du client connecté
//     if (reservation.client._id.toString() !== req.user.id) {
//       return res.status(403).json({ message: 'Accès interdit' });
//     }
//     // Calcul total
//     const nuits = Math.ceil(
//       (new Date(reservation.date_fin) - new Date(reservation.date_debut))
//       / (1000 * 60 * 60 * 24)
//     );
//     const total = reservation.chambre.prix_nuit * nuits;
//     // ⚠️ Nouveau champ correct
//     const paymentIntentId = reservation.paiement?.stripePaymentIntentId || null;
//     return res.json({
//       // Statut local (fallback)
//       status: reservation.paiement?.status || 'pending',
//       // Identifiant Stripe correct
//       intentId: paymentIntentId,
//       // Montant total
//       total
//     });
//   } catch (err) {
//     console.error('Erreur payment-status:', err);
//     res.status(500).json({ message: 'Erreur serveur' });
//   }
// });

// // Mise à jour (PERSONNEL seulement)
// router.put('/:reservationId', authMiddleware, rolesMiddleware(['PERSONNEL']), (req, res, next) => {
//   const { error } = reservationValidation(req.body, true).reservationUpdate;
//   if (error) return res.status(400).json({ message: error.details[0].message });
//   next();
// }, updateReservation);

// // Confirmer réservation
// router.put('/:id/confirm', authMiddleware, rolesMiddleware(['CLIENT']), confirmReservation);

// // Créer session de paiement Stripe
// router.post('/:reservationId/payment', authMiddleware, rolesMiddleware(['CLIENT']), createPaymentSession);

// // Webhook Stripe (raw body)
// router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
//   try {
//     handleStripeWebhook(req, res);
//   } catch (err) {
//     console.error('Webhook Stripe error:', err);
//     res.status(400).send('Webhook error');
//   }
// });

// // Suppression
// router.delete('/:reservationId', authMiddleware, rolesMiddleware(['CLIENT', 'PERSONNEL']), deleteReservation);

// export default router;



































// import { Router } from 'express';
// import express from 'express';  // Ajout : Pour express.raw (body brut pour webhook)
// import { createReservation, getAllReservations, getReservationById, updateReservation, deleteReservation, confirmReservation, checkDisponibilite } from '../controllers/reservation.controller.js';
// import { createPaymentSession, handleStripeWebhook } from '../controllers/payment.controller.js';
// import reservationValidation from '../validations/reservation.validation.js';
// import authMiddleware from '../middlewares/authMiddleware.js';
// import { rolesMiddleware } from '../middlewares/rolesMiddleware.js';
// import Reservation from '../models/reservation.model.js';

// const router = Router();

// // Création d'une réservation (seulement CLIENT, validation en middleware)
// router.post('/', authMiddleware, rolesMiddleware(['CLIENT']), (req, res, next) => {
//   if (!req.body.client) req.body.client = req.user.id;
//   const { error } = reservationValidation(req.body, false).reservationCreate;
//   if (error) return res.status(400).json({ message: error.details[0].message });
//   next();
// }, createReservation);

// // Route PUBLIQUE : Vérif disponibilité
// router.post('/:hotelId/disponibilites', checkDisponibilite);

// // Liste des réservations
// router.get('/all', authMiddleware, rolesMiddleware(['CLIENT', 'PERSONNEL']), getAllReservations);

// // Récupère une réservation par ID
// router.get('/:reservationId', authMiddleware, rolesMiddleware(['CLIENT', 'PERSONNEL']), getReservationById);

// // ⭐ PAYEMENT STATUS (corrigé mais structure identique)
// router.get('/:id/payment-status', authMiddleware, rolesMiddleware(['CLIENT']), async (req, res) => {
//   try {
//     const { id } = req.params;
//     const reservation = await Reservation
//       .findById(id)
//       .populate('chambre.hotel client');

//     if (!reservation) {
//       return res.status(404).json({ message: 'Réservation non trouvée' });
//     }

//     // Vérification que c'est bien la réservation du client connecté
//     if (reservation.client._id.toString() !== req.user.id) {
//       return res.status(403).json({ message: 'Accès interdit' });
//     }

//     // Calcul total
//     const nuits = Math.ceil(
//       (new Date(reservation.date_fin) - new Date(reservation.date_debut))
//       / (1000 * 60 * 60 * 24)
//     );
//     const total = reservation.chambre.prix_nuit * nuits;

//     // ⚠️ Nouveau champ correct
//     const paymentIntentId = reservation.paiement?.stripePaymentIntentId || null;

//     return res.json({
//       // Statut local (fallback)
//       status: reservation.paiement?.status || 'pending',
//       // Identifiant Stripe correct
//       intentId: paymentIntentId,
//       // Montant total
//       total
//     });

//   } catch (err) {
//     console.error('Erreur payment-status:', err);
//     res.status(500).json({ message: 'Erreur serveur' });
//   }
// });

// // Mise à jour (PERSONNEL seulement)
// router.put('/:reservationId', authMiddleware, rolesMiddleware(['PERSONNEL']), (req, res, next) => {
//   const { error } = reservationValidation(req.body, true).reservationUpdate;
//   if (error) return res.status(400).json({ message: error.details[0].message });
//   next();
// }, updateReservation);

// // Confirmer réservation
// router.put('/:id/confirm', authMiddleware, rolesMiddleware(['CLIENT']), confirmReservation);

// // Créer session de paiement Stripe
// router.post('/:reservationId/payment', authMiddleware, rolesMiddleware(['CLIENT']), createPaymentSession);

// // Webhook Stripe (raw body)
// router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
//   try {
//     handleStripeWebhook(req, res);
//   } catch (err) {
//     console.error('Webhook Stripe error:', err);
//     res.status(400).send('Webhook error');
//   }
// });

// // Suppression
// router.delete('/:reservationId', authMiddleware, rolesMiddleware(['CLIENT', 'PERSONNEL']), deleteReservation);

// export default router;


























