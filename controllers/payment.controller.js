import stripe from 'stripe';
import Reservation from '../models/reservation.model.js';
import User from '../models/user.model.js';
import PDFDocument from 'pdfkit';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

// FIX __dirname en ESM 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FACTURES_DIR = path.join(__dirname, '..', 'factures');

// Crée le dossier factures s'il n'existe pas
await fs.mkdir(FACTURES_DIR, { recursive: true }).catch(() => {});
const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

// Créer session de paiement
export const createPaymentSession = async (req, res) => {
  try {
    const { reservationId } = req.params;

    console.log("📌 Création session paiement pour réservation :", reservationId);

    const reservation = await Reservation.findById(reservationId)
      .populate({
        path: 'chambre',
        populate: { path: 'hotel', select: 'nom adresse ville' }
      });

    if (!reservation || reservation.client.toString() !== req.user.id) {
      console.log("❌ Accès interdit pour réservation :", reservationId);
      return res.status(403).json({ message: 'Accès interdit' });
    }

    const nuits = Math.ceil((new Date(reservation.date_fin) - new Date(reservation.date_debut)) / 86400000);
    const montant = (reservation.chambre?.prix_nuit || 0) * nuits;

    console.log("💶 Montant total :", montant);

    const session = await stripeInstance.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${reservation.chambre?.type_chambre || 'Chambre'} - ${reservation.chambre?.hotel?.nom || 'Hôtel'}`,
            description: `${nuits} nuits • ${new Date(reservation.date_debut).toLocaleDateString('fr-FR')} → ${new Date(reservation.date_fin).toLocaleDateString('fr-FR')}`
          },
          unit_amount: montant * 100,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/paiement/success?resa=${reservationId}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/paiement/cancel?resa=${reservationId}`,
      metadata: { reservationId: reservationId.toString() }
    });

    console.log("✅ Session Stripe créée :", session.id);
    res.json({ checkoutUrl: session.url });

  } catch (err) {
    console.error('❌ Erreur session Stripe:', err);
    res.status(500).json({ message: 'Erreur création paiement' });
  }
};

// Webhook Stripe → Génère le PDF dynamique
 export const handleStripeWebhook = async (req, res) => {
  console.log("🔥 Webhook Stripe reçu !");
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripeInstance.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log("🔐 Signature Webhook validée !");
  } catch (err) {
    console.error('❌ Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    console.log("💳 Paiement Stripe confirmé → génération facture…");

    const session = event.data.object;
    const reservationId = session.metadata.reservationId;

    const reservation = await Reservation.findById(reservationId)
      .populate('client')
      .populate({
        path: 'chambre',
        populate: { path: 'hotel', select: 'nom adresse ville' }
      });

    if (!reservation) {
      console.log("❌ Réservation non trouvée :", reservationId);
      return res.status(404).send('Réservation non trouvée');
    }

    const nuits = Math.ceil((new Date(reservation.date_fin) - new Date(reservation.date_debut)) / 86400000) || 1;
    const montantCalcule = (reservation.chambre?.prix_nuit || 0) * nuits;
    const montantFinal = (session.amount_total ? session.amount_total / 100 : montantCalcule);

    // Mise à jour de la réservation
    reservation.statut = 'Payée';
    reservation.statut_paiement = 'paid';
    reservation.montant_total = montantFinal;
    reservation.paidAt = new Date();
    reservation.paiement = {
      status: 'succeeded',
      stripePaymentIntentId: session.payment_intent,
      date: new Date()
    };

    await reservation.save();

    try {
      const pdfPath = path.join(FACTURES_DIR, `facture_${String(reservation._id)}.pdf`);
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fsSync.createWriteStream(pdfPath);

      doc.pipe(stream);

      // Nom de l'hôtel dynamique
      const nomHotel = reservation.chambre?.hotel?.nom || 'HôtelBooking';
      const adresseHotel = reservation.chambre?.hotel?.adresse || '';

      // === Contenu dynamique du PDF ===
      doc.fontSize(24).fillColor('#1e40af').text('FACTURE', { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text(nomHotel, { align: 'center' });
      if (adresseHotel) doc.fontSize(12).text(adresseHotel, { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(12)
        .text(`Facture N°: ${reservation._id.toString()}`)
        .text(`Date: ${new Date().toLocaleDateString('fr-FR')}`)
        .moveDown()
        .text(`Client: ${reservation.client?.prenom || ''} ${reservation.client?.nom || ''}`)
        .text(`Email: ${reservation.client?.email || ''}`)
        .moveDown(2);

      doc.fontSize(14).text('Détails de la réservation', { underline: true });
      doc.fontSize(11)
        .text(`Hôtel: ${nomHotel}`)
        .text(`Chambre: ${reservation.chambre?.type_chambre || 'Chambre'}`)
        .text(`Arrivée: ${new Date(reservation.date_debut).toLocaleDateString('fr-FR')}`)
        .text(`Départ: ${new Date(reservation.date_fin).toLocaleDateString('fr-FR')}`)
        .text(`Durée: ${nuits} nuit${nuits > 1 ? 's' : ''}`)
        .moveDown(2);

      doc.fontSize(18).text(`TOTAL: ${montantFinal.toFixed(2)} €`, { align: 'right' });
      doc.moveDown(3);
      doc.fontSize(10).fillColor('#666').text('Merci pour votre confiance !', { align: 'center' });

      doc.end();

      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });

    } catch (pdfErr) {
      console.error('❌ ERREUR GÉNÉRATION PDF:', pdfErr);
    }
  }

  res.json({ received: true });
};

// Liste des factures
 export const getMesFactures = async (req, res) => {
  try {
    const userId = req.user.id;

    const reservations = await Reservation.find({
      client: userId,
      $or: [
        { statut_paiement: 'paid' },
        { statut: 'Payée' },
        { "paiement.status": "succeeded" }
      ]
    })
      .populate({
        path: 'chambre',
        select: 'type_chambre prix_nuit',
        populate: { path: 'hotel', select: 'nom adresse' }
      })
      .sort({ paidAt: -1, updatedAt: -1 });

    res.json({
      factures: reservations.map(resa => {
        const nuits = Math.ceil((new Date(resa.date_fin) - new Date(resa.date_debut)) / 86400000) || 1;
        const totalCalcule = resa.montant_total || (resa.chambre?.prix_nuit ? resa.chambre.prix_nuit * nuits : 0);

        return {
          id: resa._id.toString(),
          hotel: resa.chambre?.hotel?.nom || 'Hôtel',
          adresse: resa.chambre?.hotel?.adresse || '',
          chambre: resa.chambre?.type_chambre || 'Chambre',
          dates: `${new Date(resa.date_debut).toLocaleDateString('fr-FR')} → ${new Date(resa.date_fin).toLocaleDateString('fr-FR')}`,
          total: totalCalcule ? Number(totalCalcule).toFixed(2) : '0.00',
          datePaiement: resa.paidAt ? new Date(resa.paidAt).toLocaleDateString('fr-FR') : new Date(resa.updatedAt).toLocaleDateString('fr-FR'),
          pdfUrl: `${process.env.BACKEND_URL || 'http://localhost:3000'}/factures/facture_${resa._id}.pdf`
        };
      })
    });

  } catch (err) {
    console.error('❌ ERREUR getMesFactures:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Téléchargement sécurisé du PDF
 export const downloadFacture = async (req, res) => {
  try {
    const { id } = req.params;

    const reservation = await Reservation.findById(id);

    if (!reservation || reservation.client.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Accès interdit' });
    }

    const pdfPath = path.join(FACTURES_DIR, `facture_${id}.pdf`);
    await fs.access(pdfPath);

    res.download(pdfPath, `facture_${id}.pdf`);

  } catch (err) {
    res.status(404).json({ message: 'Facture non trouvée' });
  }
};

// Vérification statut paiement
 export const getPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ message: 'Réservation introuvable' });
    }

    res.json({
      reservationId: reservation._id,
      payment_status: reservation.statut_paiement || reservation.paiement?.status || 'pending'
    });

  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

