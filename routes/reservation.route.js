import { Router } from 'express';
import express from 'express';

import { createReservation, getAllReservations, getReservationById, updateReservation, deleteReservation, confirmReservation, checkDisponibilite, 
  getUserReservations } from '../controllers/reservation.controller.js';

import { createPaymentSession, handleStripeWebhook, getMesFactures, downloadFacture, getPaymentStatus } from '../controllers/payment.controller.js';

import reservationValidation from '../validations/reservation.validation.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { rolesMiddleware } from '../middlewares/rolesMiddleware.js';
import Reservation from '../models/reservation.model.js';

const router = Router();

// Liste des factures du client
router.get( '/factures', authMiddleware, rolesMiddleware(['CLIENT']), getMesFactures );

// Télécharger une facture (ID de la réservation)
router.get( '/:id/facture/download', authMiddleware, rolesMiddleware(['CLIENT']), downloadFacture );

// Webhook Stripe
router.post( '/webhook',
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

// Réservations d'une chambre 
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

router.get(
  '/:id/payment-status',
  authMiddleware,
  rolesMiddleware(['CLIENT']),
  getPaymentStatus
);

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


























































