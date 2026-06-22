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

// === FIX __dirname en ESM ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FACTURES_DIR = path.join(__dirname, '..', 'factures');

// Crée le dossier factures s'il n'existe pas (au démarrage)
await fs.mkdir(FACTURES_DIR, { recursive: true }).catch(() => {});
const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

// --------------------------------------------------
// 1. Créer session de paiement
// --------------------------------------------------
export const createPaymentSession = async (req, res) => {
  try {
    const { reservationId } = req.params;

    console.log("📌 Création session paiement pour réservation :", reservationId);

    const reservation = await Reservation.findById(reservationId)
      .populate('chambre')
      .populate({ path: 'chambre.hotel', select: 'nom' });

    if (!reservation || reservation.client.toString() !== req.user.id) {
      console.log("❌ Accès interdit pour réservation :", reservationId);
      return res.status(403).json({ message: 'Accès interdit' });
    }

    const nuits = Math.ceil((new Date(reservation.date_fin) - new Date(reservation.date_debut)) / 86400000);
    const montant = reservation.chambre.prix_nuit * nuits;

    console.log("💶 Montant total :", montant);

    const session = await stripeInstance.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${reservation.chambre.type_chambre} - ${reservation.chambre.hotel?.nom || 'Hôtel'}`,
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

// --------------------------------------------------
// 2. Webhook Stripe → Génère SEULEMENT le PDF
// --------------------------------------------------
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

    console.log("📌 Reservation ID depuis Stripe :", reservationId);

    const reservation = await Reservation.findById(reservationId)
      .populate('client')
      .populate('chambre')
      .populate({ path: 'chambre.hotel', select: 'nom adresse' });

    if (!reservation) {
      console.log("❌ Réservation non trouvée :", reservationId);
      return res.status(404).send('Réservation non trouvée');
    }

    console.log("🧾 Génération PDF pour :", reservation.client.email);

    // Marquer comme payée
    reservation.statut = 'Payée';
    reservation.statut_paiement = 'paid';
    reservation.montant_total = session.amount_total / 100;
    reservation.paidAt = new Date();
    reservation.paiement = {
      status: 'succeeded',
      stripePaymentIntentId: session.payment_intent,
      date: new Date()
    };

    await reservation.save();
    console.log("💾 Réservation mise à jour comme payée");

    try {
      // Générer le PDF
      const pdfPath = path.join(FACTURES_DIR, `facture_${String(reservation._id)}.pdf`);
      console.log("📝 Création du fichier PDF à :", pdfPath);

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fsSync.createWriteStream(pdfPath);

      doc.pipe(stream);

      // === Contenu du PDF ===
      doc.fontSize(24).fillColor('#1e40af').text('FACTURE', { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text('Hôtel La Lumière', { align: 'center' });
      doc.fontSize(12).text('Monaco', { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(12)
        .text(`Facture N°: ${reservation._id.toString()}`)
        .text(`Date: ${new Date().toLocaleDateString('fr-FR')}`)
        .moveDown()
        .text(`Client: ${reservation.client?.prenom || ''} ${reservation.client?.nom || ''}`)
        .text(`Email: ${reservation.client?.email || ''}`)
        .moveDown(2);

      const nuits = Math.ceil((new Date(reservation.date_fin) - new Date(reservation.date_debut)) / 86400000) || 0;

      doc.fontSize(14).text('Détails de la réservation', { underline: true });
      doc.fontSize(11)
        .text(`Hôtel: ${reservation.chambre?.hotel?.nom || 'Hôtel La Lumière'} - Monaco`)
        .text(`Chambre: ${reservation.chambre?.type_chambre || 'Chambre'}`)
        .text(`Arrivée: ${new Date(reservation.date_debut).toLocaleDateString('fr-FR') || 'Inconnu'}`)
        .text(`Départ: ${new Date(reservation.date_fin).toLocaleDateString('fr-FR') || 'Inconnu'}`)
        .text(`Durée: ${nuits} nuit${nuits > 1 ? 's' : ''}`)
        .moveDown(2);

      doc.fontSize(18).text(`TOTAL: ${reservation.montant_total?.toFixed(2) || '0.00'} €`, { align: 'right' });
      doc.moveDown(3);
      doc.fontSize(10).fillColor('#666').text('Merci pour votre confiance !', { align: 'center' });

      doc.end();

      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });

      console.log('🎉 Facture générée →', pdfPath);

    } catch (pdfErr) {
      console.error('❌ ERREUR GÉNÉRATION PDF:', pdfErr);
    }
  }

  // Toujours répondre 200 au webhook Stripe
  res.json({ received: true });
};

// --------------------------------------------------
// 3. Liste des factures (Mes Factures)
// --------------------------------------------------
export const getMesFactures = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("📂 Récupération des factures pour :", userId);

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
      factures: reservations.map(resa => ({
        id: resa._id.toString(),
        hotel: resa.chambre?.hotel?.nom || 'Hôtel La Lumière',
        adresse: resa.chambre?.hotel?.adresse || 'Monaco',
        chambre: resa.chambre?.type_chambre || 'Chambre',
        dates: `${new Date(resa.date_debut).toLocaleDateString('fr-FR')} → ${new Date(resa.date_fin).toLocaleDateString('fr-FR')}`,
        total: resa.montant_total?.toFixed(2),
        datePaiement: resa.paidAt ? new Date(resa.paidAt).toLocaleDateString('fr-FR') : new Date(resa.updatedAt).toLocaleDateString('fr-FR'),
        pdfUrl: `${process.env.BACKEND_URL || 'http://localhost:3000'}/factures/facture_${resa._id}.pdf`
      }))
    });

  } catch (err) {
    console.error('❌ ERREUR getMesFactures:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// --------------------------------------------------
// 4. Téléchargement sécurisé du PDF
// --------------------------------------------------
export const downloadFacture = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("📥 Tentative de téléchargement facture :", id);

    const reservation = await Reservation.findById(id);

    if (!reservation || reservation.client.toString() !== req.user.id || reservation.statut_paiement !== 'paid') {
      console.log("❌ Accès interdit téléchargement :", id);
      return res.status(403).json({ message: 'Accès interdit' });
    }

    const pdfPath = path.join(FACTURES_DIR, `facture_${id}.pdf`);
    await fs.access(pdfPath);

    console.log("📄 Téléchargement PDF depuis :", pdfPath);

    res.download(pdfPath, `facture_${id}.pdf`);

  } catch (err) {
    console.log("❌ Facture non trouvée :", err);
    res.status(404).json({ message: 'Facture non trouvée' });
  }
};

// --------------------------------------------------
// 5. Vérification statut paiement
// --------------------------------------------------
export const getPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("🔍 Vérification paiement pour réservation :", id);

    const reservation = await Reservation.findById(id);
    if (!reservation) {
      console.log("❌ Réservation introuvable");
      return res.status(404).json({ message: 'Réservation introuvable' });
    }

    res.json({
      reservationId: reservation._id,
      payment_status: reservation.statut_paiement || reservation.paiement?.status || 'pending'
    });

  } catch (err) {
    console.error('❌ Erreur getPaymentStatus:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};





























// import stripe from 'stripe';
// import Reservation from '../models/reservation.model.js';
// import User from '../models/user.model.js';
// import PDFDocument from 'pdfkit';
// import fs from 'fs/promises';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import dotenv from 'dotenv';

// dotenv.config();

// // === FIX __dirname en ESM ===
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const FACTURES_DIR = path.join(__dirname, '..', 'factures');

// // Crée le dossier factures s'il n'existe pas
// await fs.mkdir(FACTURES_DIR, { recursive: true }).catch(() => {});

// const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

// // --------------------------------------------------
// // 1. Créer session de paiement (inchangé, parfait)
// // --------------------------------------------------
// export const createPaymentSession = async (req, res) => {
//   try {
//     const { reservationId } = req.params;
//     const reservation = await Reservation.findById(reservationId)
//       .populate('chambre')
//       .populate({ path: 'chambre.hotel', select: 'nom' });

//     if (!reservation || reservation.client.toString() !== req.user.id) {
//       return res.status(403).json({ message: 'Accès interdit' });
//     }

//     const nuits = Math.ceil((new Date(reservation.date_fin) - new Date(reservation.date_debut)) / (86400000));
//     const montant = reservation.chambre.prix_nuit * nuits;

//     const session = await stripeInstance.checkout.sessions.create({
//       payment_method_types: ['card'],
//       line_items: [{
//         price_data: {
//           currency: 'eur',
//           product_data: {
//             name: `${reservation.chambre.type_chambre} - ${reservation.chambre.hotel?.nom || 'Hôtel'}`,
//             description: `${nuits} nuits • ${new Date(reservation.date_debut).toLocaleDateString('fr-FR')} → ${new Date(reservation.date_fin).toLocaleDateString('fr-FR')}`
//           },
//           unit_amount: montant * 100,
//         },
//         quantity: 1,
//       }],
//       mode: 'payment',
//       success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/paiement/success?resa=${reservationId}`,
//       cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/paiement/cancel?resa=${reservationId}`,
//       metadata: { reservationId: reservationId.toString() }
//     });

//     res.json({ checkoutUrl: session.url });
//   } catch (err) {
//     console.error('Erreur session Stripe:', err);
//     res.status(500).json({ message: 'Erreur création paiement' });
//   }
// };

// // --------------------------------------------------
// // 2. Webhook Stripe → Génère PDF + Email (CORRIGÉ)
// // --------------------------------------------------
// export const handleStripeWebhook = async (req, res) => {
//   const sig = req.headers['stripe-signature'];
//   let event;

//   try {
//     event = stripeInstance.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
//   } catch (err) {
//     console.error('Webhook signature error:', err.message);
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   if (event.type === 'checkout.session.completed') {
//     const session = event.data.object;
//     const reservationId = session.metadata.reservationId;

//     const reservation = await Reservation.findById(reservationId)
//       .populate('client')
//       .populate('chambre')
//       .populate({ path: 'chambre.hotel', select: 'nom adresse' });

//     if (!reservation) return res.status(404).send('Réservation non trouvée');

//     // Marquer comme payée
//     reservation.statut = 'Payée';
//     reservation.statut_paiement = 'paid';
//     reservation.montant_total = session.amount_total / 100;
//     reservation.paidAt = new Date();
//     reservation.paiement = {
//       status: 'succeeded',
//       stripePaymentIntentId: session.payment_intent,
//       date: new Date()
//     };
//     await reservation.save();

//     // Générer le PDF une seule fois
//     const pdfPath = path.join(FACTURES_DIR, `facture_${reservation._id}.pdf`);
//     const doc = new PDFDocument({ margin: 50, size: 'A4' });
//     const stream = fs.createWriteStream(pdfPath);
//     doc.pipe(stream);

//     // Contenu facture
//     doc.fontSize(24).fillColor('#1e40af').text('FACTURE', { align: 'center' });
//     doc.moveDown();
//     doc.fontSize(16).text('Hôtel La Lumière', { align: 'center' });
//     doc.fontSize(12).text('Monaco', { align: 'center' });
//     doc.moveDown(2);

//     doc.fontSize(12)
//       .text(`Facture N°: ${reservation._id}`)
//       .text(`Date: ${new Date().toLocaleDateString('fr-FR')}`)
//       .moveDown()
//       .text(`Client: ${reservation.client.prenom} ${reservation.client.nom}`)
//       .text(`Email: ${reservation.client.email}`)
//       .moveDown(2);

//     const nuits = Math.ceil((new Date(reservation.date_fin) - new Date(reservation.date_debut)) / 86400000);

//     doc.fontSize(14).text('Détails de la réservation', { underline: true });
//     doc.fontSize(11)
//       .text(`Hôtel: ${reservation.chambre.hotel?.nom || 'Hôtel La Lumière'} - Monaco`)
//       .text(`Chambre: ${reservation.chambre.type_chambre}`)
//       .text(`Arrivée: ${new Date(reservation.date_debut).toLocaleDateString('fr-FR')}`)
//       .text(`Départ: ${new Date(reservation.date_fin).toLocaleDateString('fr-FR')}`)
//       .text(`Durée: ${nuits} nuit${nuits > 1 ? 's' : ''}`)
//       .moveDown(2);

//     doc.fontSize(18).text(`TOTAL: ${reservation.montant_total.toFixed(2)} €`, { align: 'right' });
//     doc.moveDown(3);
//     doc.fontSize(10).fillColor('#666').text('Merci pour votre confiance !', { align: 'center' });

//     doc.end();

//     // Attendre que le PDF soit écrit
//     await new Promise((resolve, reject) => {
//       stream.on('finish', resolve);
//       stream.on('error', reject);
//     });

//     console.log('Facture générée →', pdfPath);

//     // Envoi email
//     try {
//       const transporter = nodemailer.createTransporter({
//         service: 'gmail',
//         auth: {
//           user: process.env.EMAIL_USER,
//           pass: process.env.EMAIL_PASS
//         }
//       });

//       await transporter.sendMail({
//         from: `"Hôtel La Lumière" <${process.env.EMAIL_USER}>`,
//         to: reservation.client.email,
//         subject: `Votre facture - Réservation ${reservation._id}`,
//         html: `<h2>Paiement confirmé !</h2><p>Voici votre facture en pièce jointe.</p>`,
//         attachments: [{ filename: `facture_${reservation._id}.pdf`, path: pdfPath }]
//       });
//       console.log('Email envoyé à', reservation.client.email);
//     } catch (emailErr) {
//       console.error('Erreur envoi email:', emailErr);
//     }
//   }

//   res.json({ received: true });
// };

// // --------------------------------------------------
// // 3. Liste des factures (front "Mes Factures")
// // --------------------------------------------------
// // payment.controller.js → getMesFactures (VERSION QUI NE PLANTE JAMAIS)
// export const getMesFactures = async (req, res) => {
//   try {
//     const userId = req.user.id;

//     const reservations = await Reservation.find({
//       client: userId,
//       $or: [
//         { statut_paiement: 'paid' },
//         { statut: 'Payée' },
//         { "paiement.status": "succeeded" }
//       ]
//     })
//     .populate({
//       path: 'chambre',
//       select: 'type_chambre prix_nuit',
//       populate: {
//         path: 'hotel',
//         select: 'nom adresse'
//       }
//     })
//     .sort({ paidAt: -1, updatedAt: -1 });

//     const factures = reservations.map(resa => {
//       const chambre = resa.chambre || {};
//       const hotel = chambre.hotel || {};
      
//       const total = resa.montant_total || 
//         (chambre.prix_nuit || 0) * 
//         Math.ceil((new Date(resa.date_fin) - new Date(resa.date_debut)) / 86400000);

//       return {
//         id: resa._id.toString(),
//         hotel: hotel.nom || 'Hôtel La Lumière',
//         adresse: hotel.adresse || 'Monaco',
//         chambre: chambre.type_chambre || 'Chambre',
//         dates: `${new Date(resa.date_debut).toLocaleDateString('fr-FR')} → ${new Date(resa.date_fin).toLocaleDateString('fr-FR')}`,
//         total: total.toFixed(2),
//         datePaiement: resa.paidAt 
//           ? new Date(resa.paidAt).toLocaleDateString('fr-FR')
//           : new Date(resa.updatedAt).toLocaleDateString('fr-FR'),
//         pdfUrl: `http://localhost:3000/factures/facture_${resa._id}.pdf`
//       };
//     });

//     res.json({ factures });
//   } catch (err) {
//     console.error('ERREUR FATALE getMesFactures:', err);
//     res.status(500).json({ 
//       message: 'Erreur serveur', 
//       error: err.message 
//     });
//   }
// };

// // --------------------------------------------------
// // 4. Téléchargement direct du PDF (sécurisé)
// // --------------------------------------------------
// export const downloadFacture = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const reservation = await Reservation.findById(id);
//     if (!reservation || reservation.client.toString() !== req.user.id || reservation.statut_paiement !== 'paid') {
//       return res.status(403).json({ message: 'Accès interdit' });
//     }

//     const pdfPath = path.join(FACTURES_DIR, `facture_${id}.pdf`);
//     await fs.access(pdfPath); // Vérifie que le fichier existe

//     res.download(pdfPath, `facture_${id}.pdf`);
//   } catch (err) {
//     res.status(404).json({ message: 'Facture non trouvée' });
//   }
// };

// // --------------------------------------------------
// // 5. Vérification statut paiement (payment-status)
// // --------------------------------------------------
// export const getPaymentStatus = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const reservation = await Reservation.findById(id);

//     if (!reservation) {
//       return res.status(404).json({ message: 'Réservation introuvable' });
//     }

//     // Retour clairement structuré
//     return res.json({
//       reservationId: reservation._id,
//       payment_status: reservation.statut_paiement || reservation.paiement?.status || 'pending'
//     });

//   } catch (err) {
//     console.error('Erreur payment-status:', err);
//     res.status(500).json({ message: 'Erreur serveur vérification paiement' });
//   }
// };




























// import stripe from 'stripe';
// import Reservation from '../models/reservation.model.js';
// import User from '../models/user.model.js';
// import PDFDocument from 'pdfkit';
// import fs from 'fs';
// import path from 'path';
// import nodemailer from 'nodemailer';
// import dotenv from 'dotenv';



// dotenv.config();
// console.log('Stripe key:', process.env.STRIPE_SECRET_KEY ? 'OK' : 'NON DEFINI');
// const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

// // ✅ Créer session de paiement Stripe (VERSION À JOUR)
// export const createPaymentSession = async (req, res) => {
//   try {
//     const { reservationId } = req.params;
//     const reservation = await Reservation.findById(reservationId).populate('chambre client');
//     if (!reservation) {
//       return res.status(404).json({ message: 'Réservation non trouvée' });
//     }
//     if (reservation.client._id.toString() !== req.user.id) {
//       return res.status(403).json({ message: 'Accès interdit à cette réservation' });
//     }
//     if (!['Confirmée', 'En attente'].includes(reservation.statut)) {
//       return res.status(400).json({ message: `Réservation non éligible: statut ${reservation.statut}` });
//     }
//     // Calcul montant
//     const dateDebut = new Date(reservation.date_debut);
//     const dateFin = new Date(reservation.date_fin);
//     const nuits = Math.ceil((dateFin.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24));
//     const montant = reservation.chambre.prix_nuit * nuits;
//     // Création session Stripe
//     const session = await stripeInstance.checkout.sessions.create({
//       payment_method_types: ['card'],
//       line_items: [
//         {
//           price_data: {
//             currency: 'eur',
//             product_data: {
//               name: `${reservation.chambre.type_chambre} - ${reservation.chambre.hotel?.nom || 'Hôtel'}`,
//               description: `${nuits} nuits du ${reservation.date_debut.toLocaleDateString()} au ${reservation.date_fin.toLocaleDateString()}`,
//             },
//             unit_amount: montant * 100, // en centimes
//           },
//           quantity: 1,
//         },
//       ],
//       mode: 'payment',
//       success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/paiement/success?resa=${reservationId}`,
//       cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/paiement/cancel?resa=${reservationId}`,
//       metadata: {
//         reservationId: reservationId.toString(),
//         userId: reservation.client._id.toString(),
//       },
//     });
//     // ✅ On renvoie directement l'URL de Stripe Checkout
//     res.json({
//       checkoutUrl: session.url
//     });
//   } catch (err) {
//     console.error('Erreur création session Stripe:', err);
//     res.status(500).json({ message: 'Erreur serveur création session paiement', error: err.message });
//   }
// };

// // -----------------------------------------------------
// // 🔥 WEBHOOK POUR FINALISER LE PAIEMENT + PDF + EMAIL
// // -----------------------------------------------------
// export const handleStripeWebhook = async (req, res) => {
//   const sig = req.headers['stripe-signature'];
//   let event;
//   try {
//     event = stripeInstance.webhooks.constructEvent(
//       req.body,
//       sig,
//       process.env.STRIPE_WEBHOOK_SECRET
//     );
//   } catch (err) {
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }
//   if (event.type === "checkout.session.completed") {
//     const session = event.data.object;
//     const reservationId = session.metadata.reservationId;
//     const reservation = await Reservation.findById(reservationId)
//       .populate('client')
//       .populate('chambre chambre.hotel');
//     if (!reservation) return res.status(404).send();
//     // Marquer comme payé
//     reservation.statut = "Payée";
//     reservation.paiement = {
//       status: "succeeded",
//       date: new Date(),
//       stripePaymentIntentId: session.payment_intent
//     };
//     await reservation.save();
//     // Calcul nuits
//     const dateDebut = new Date(reservation.date_debut);
//     const dateFin = new Date(reservation.date_fin);
//     const nuits = Math.ceil((dateFin.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24));
//     // Mettre à jour paiement avec nuits
//     reservation.paiement.nuits = nuits;
//     await reservation.save();  // Deuxième save pour persister nuits
//     // Générer PDF
//     const pdfPath = path.join(__dirname, '..', 'factures', `facture_${reservationId}.pdf`);  // Dossier factures/ à la racine
//     const doc = new PDFDocument({ margin: 50 });
//     doc.pipe(fs.createWriteStream(pdfPath));
//     // Contenu PDF amélioré (ajoutez logo/haut de page si besoin)
//     doc.fontSize(20).text('Facture de Réservation', { align: 'center' });
//     doc.moveDown();
//     doc.fontSize(12).text(`ID Réservation: ${reservation._id}`);
//     doc.fontSize(14).text(`Client: ${reservation.client.prenom} ${reservation.client.nom}`);
//     doc.text(`Email: ${reservation.client.email}`);
//     doc.moveDown();
//     doc.fontSize(14).text(`Hôtel: ${reservation.chambre.hotel?.nom}`);
//     doc.text(`Chambre: ${reservation.chambre.type_chambre}`);
//     doc.text(`Dates: ${reservation.date_debut.toLocaleDateString('fr-FR')} → ${reservation.date_fin.toLocaleDateString('fr-FR')}`);
//     doc.text(`Nuits: ${nuits}`);
//     doc.moveDown();
//     doc.fontSize(16).text(`Total: ${reservation.chambre.prix_nuit * nuits} €`, { align: 'right' });
//     doc.moveDown();
//     doc.fontSize(10).text(`Paiement confirmé le: ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
//     doc.end();
//     console.log("PDF généré:", pdfPath);
//     // Envoi email avec pièce jointe (après fin PDF)
//     doc.on('end', async () => {
//       try {
//         const transporter = nodemailer.createTransporter({
//           service: 'gmail',  // Ou 'outlook', etc.
//           auth: {
//             user: process.env.EMAIL_USER,
//             pass: process.env.EMAIL_PASS
//           }
//         });
//         await transporter.sendMail({
//           from: `"Hôtel App" <${process.env.EMAIL_USER}>`,
//           to: reservation.client.email,
//           subject: `Facture de votre réservation ${reservation._id} - Paiement confirmé`,
//           html: `
//             <h2>Merci pour votre paiement !</h2>
//             <p>Votre réservation est confirmée. Voici votre facture en pièce jointe.</p>
//             <p><strong>Détails :</strong><br/>
//             Hôtel: ${reservation.chambre.hotel?.nom}<br/>
//             Dates: ${reservation.date_debut.toLocaleDateString('fr-FR')} au ${reservation.date_fin.toLocaleDateString('fr-FR')}<br/>
//             Total: ${reservation.chambre.prix_nuit * nuits} €</p>
//             <p>À bientôt !</p>
//           `,
//           attachments: [
//             {
//               filename: `facture_${reservationId}.pdf`,
//               path: pdfPath,
//               contentType: 'application/pdf'
//             }
//           ]
//         });
//         console.log('Email envoyé à', reservation.client.email);
//         // Nettoyer PDF local (optionnel, pour éviter accumulation)
//         fs.unlinkSync(pdfPath);
//       } catch (emailErr) {
//         console.error('Erreur envoi email:', emailErr);
//         // Ne pas throw : le paiement est OK, l'email est bonus
//       }
//     });
//   }
//   res.json({ received: true });
// };

// // NOUVEAU : GET /api/reservations/factures (liste factures du client connecté)
// export const getMesFactures = async (req, res) => {
//   try {
//     const factures = await Reservation.find({ 
//       client: req.user.id, 
//       statut: 'Payée' 
//     })
//     .populate('chambre chambre.hotel')
//     .select(' _id statut paiement.date chambre.hotel.nom chambre.type_chambre date_debut date_fin createdAt ')
//     .sort({ 'paiement.date': -1 });  // Plus récentes en premier

//     // Mapper pour inclure chemin PDF (générez à la volée si pas stocké)
//     const facturesList = factures.map(facture => ({
//       id: facture._id,
//       hotel: facture.chambre.hotel.nom,
//       chambre: facture.chambre.type_chambre,
//       dates: `${new Date(facture.date_debut).toLocaleDateString('fr-FR')} au ${new Date(facture.date_fin).toLocaleDateString('fr-FR')}`,
//       total: facture.chambre.prix_nuit * Math.ceil((new Date(facture.date_fin) - new Date(facture.date_debut)) / (1000 * 60 * 60 * 24)),
//       datePaiement: new Date(facture.paiement.date).toLocaleDateString('fr-FR'),
//       pdfUrl: `/api/reservations/${facture._id}/facture/download`  // Endpoint de DL
//     }));

//     res.json({ factures: facturesList });
//   } catch (err) {
//     res.status(500).json({ message: 'Erreur liste factures', error: err.message });
//   }
// };

// // NOUVEAU : GET /api/reservations/:id/facture/download (télécharge PDF)
// export const downloadFacture = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const reservation = await Reservation.findById(id).populate('client chambre chambre.hotel');
//     if (!reservation || reservation.statut !== 'Payée' || reservation.client._id.toString() !== req.user.id) {
//       return res.status(403).json({ message: 'Accès interdit' });
//     }

//     // Régénérer PDF à la volée (même logique que webhook)
//     const nuits = Math.ceil((new Date(reservation.date_fin) - new Date(reservation.date_debut)) / (1000 * 60 * 60 * 24));
//     const doc = new PDFDocument({ margin: 50 });
//     const stream = doc.pipe(res);  // Stream direct vers response (pas de fichier local)
//     res.setHeader('Content-Type', 'application/pdf');
//     res.setHeader('Content-Disposition', `attachment; filename="facture_${id}.pdf"`);

//     // Contenu PDF (identique au webhook)
//     doc.fontSize(20).text('Facture de Réservation', { align: 'center' });
//     doc.moveDown();
//     doc.fontSize(12).text(`ID Réservation: ${reservation._id}`);
//     doc.fontSize(14).text(`Client: ${reservation.client.prenom} ${reservation.client.nom}`);
//     doc.text(`Email: ${reservation.client.email}`);
//     doc.moveDown();
//     doc.fontSize(14).text(`Hôtel: ${reservation.chambre.hotel?.nom}`);
//     doc.text(`Chambre: ${reservation.chambre.type_chambre}`);
//     doc.text(`Dates: ${reservation.date_debut.toLocaleDateString('fr-FR')} → ${reservation.date_fin.toLocaleDateString('fr-FR')}`);
//     doc.text(`Nuits: ${nuits}`);
//     doc.moveDown();
//     doc.fontSize(16).text(`Total: ${reservation.chambre.prix_nuit * nuits} €`, { align: 'right' });
//     doc.moveDown();
//     doc.fontSize(10).text(`Paiement confirmé le: ${new Date(reservation.paiement.date).toLocaleDateString('fr-FR')}`, { align: 'right' });
//     doc.end();

//   } catch (err) {
//     console.error('Erreur DL PDF:', err);
//     res.status(500).json({ message: 'Erreur génération PDF' });
//   }
// };
































// import stripe from 'stripe';
// import Reservation from '../models/reservation.model.js';
// import User from '../models/user.model.js';
// import PDFDocument from 'pdfkit';
// import fs from 'fs';
// import path from 'path';
// import nodemailer from 'nodemailer';
// import dotenv from 'dotenv';

// dotenv.config();

// console.log('Stripe key:', process.env.STRIPE_SECRET_KEY ? 'OK' : 'NON DEFINI');
// const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

// // ✅ Créer session de paiement Stripe (VERSION À JOUR)
// export const createPaymentSession = async (req, res) => {
//   try {
//     const { reservationId } = req.params;
//     const reservation = await Reservation.findById(reservationId).populate('chambre client');

//     if (!reservation) {
//       return res.status(404).json({ message: 'Réservation non trouvée' });
//     }

//     if (reservation.client._id.toString() !== req.user.id) {
//       return res.status(403).json({ message: 'Accès interdit à cette réservation' });
//     }

//     if (!['Confirmée', 'En attente'].includes(reservation.statut)) {
//   return res.status(400).json({ message: `Réservation non éligible: statut ${reservation.statut}` });
// }


//     // Calcul montant
//     const dateDebut = new Date(reservation.date_debut);
//     const dateFin = new Date(reservation.date_fin);
//     const nuits = Math.ceil((dateFin.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24));
//     const montant = reservation.chambre.prix_nuit * nuits;

//     // Création session Stripe
//     const session = await stripeInstance.checkout.sessions.create({
//       payment_method_types: ['card'],
//       line_items: [
//         {
//           price_data: {
//             currency: 'eur',
//             product_data: {
//               name: `${reservation.chambre.type_chambre} - ${reservation.chambre.hotel?.nom || 'Hôtel'}`,
//               description: `${nuits} nuits du ${reservation.date_debut.toLocaleDateString()} au ${reservation.date_fin.toLocaleDateString()}`,
//             },
//             unit_amount: montant * 100, // en centimes
//           },
//           quantity: 1,
//         },
//       ],
//       mode: 'payment',
//       success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/paiement/success?resa=${reservationId}`,
//       cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/paiement/cancel?resa=${reservationId}`,
//       metadata: {
//         reservationId: reservationId.toString(),
//         userId: reservation.client._id.toString(),
//       },
//     });

//     // ✅ On renvoie directement l'URL de Stripe Checkout
//     res.json({
//       checkoutUrl: session.url
//     });

//   } catch (err) {
//     console.error('Erreur création session Stripe:', err);
//     res.status(500).json({ message: 'Erreur serveur création session paiement', error: err.message });
//   }
// };

// // -----------------------------------------------------
// // 🔥 WEBHOOK POUR FINALISER LE PAIEMENT + PDF + EMAIL
// // -----------------------------------------------------
// export const handleStripeWebhook = async (req, res) => {
//   const sig = req.headers['stripe-signature'];

//   let event;
//   try {
//     event = stripeInstance.webhooks.constructEvent(
//       req.body,
//       sig,
//       process.env.STRIPE_WEBHOOK_SECRET
//     );
//   } catch (err) {
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   if (event.type === "checkout.session.completed") {
//     const session = event.data.object;
//     const reservationId = session.metadata.reservationId;

//     const reservation = await Reservation.findById(reservationId)
//       .populate('client')
//       .populate('chambre chambre.hotel');

//     if (!reservation) return res.status(404).send();

//     // Marquer comme payé
//     reservation.statut = "Payée";
//     reservation.paiement = {
//       status: "succeeded",
//       date: new Date(),
//       stripePaymentIntentId: session.payment_intent
//     };
//     await reservation.save();

//     // Générer facture
//     const pdfPath = `facture_${reservationId}.pdf`;
//     const doc = new PDFDocument();
//     doc.pipe(fs.createWriteStream(pdfPath));
//     doc.fontSize(18).text(`Facture Réservation ${reservation._id}`, { align: "center" });
//     doc.moveDown();
//     doc.fontSize(14).text(`Client : ${reservation.client.prenom} ${reservation.client.nom}`);
//     doc.text(`Hôtel : ${reservation.chambre.hotel?.nom}`);
//     doc.text(`Chambre : ${reservation.chambre.type_chambre}`);
//     doc.text(`Dates : ${reservation.date_debut} → ${reservation.date_fin}`);
//     doc.text(`Montant payé : ${reservation.chambre.prix_nuit}€/nuit x ${reservation.paiement.nuits}`);
//     doc.end();

//     console.log("PDF généré pour la réservation", reservationId);
//   }

//   res.json({ received: true });
// };





























