import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// --- Import des routes ---
import userRouter from './routes/user.route.js';
import hotelRouter from './routes/hotel.route.js';
import photoRouter from './routes/photo.route.js';
import chambreRouter from './routes/chambre.route.js';
import chambrephotoRouter from './routes/chambrephoto.route.js';
import reservationRouter from './routes/reservation.route.js';
import avisRouter from './routes/avis.route.js';
import db from './db/db.js';

dotenv.config();

console.log('Debug .env:', {
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
    ? 'Loaded (length ' + process.env.STRIPE_WEBHOOK_SECRET.length + ')'
    : 'Missing'
});

// __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ==================== MIDDLEWARES GLOBAUX (ordre important) ====================
// 1. CORS
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));


app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// 2. Body parsing (IMPORTANT : avant les routes !)
app.use('/api/reservations/webhook', express.raw({ type: 'application/json' })); // Stripe webhook
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. Fichiers statiques → APRÈS le parsing, mais AVANT les routes API
app.use('/uploads', (req, res, next) => {
  console.log('Middleware /uploads hit:', req.url);
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// SOLUTION ULTIME QUI MARCHE À 100% SUR TON PC
const FACTURES_DIR = path.resolve('factures');  // ← depuis la racine du projet
console.log('Dossier factures servi depuis :', FACTURES_DIR);
app.use('/factures', express.static(FACTURES_DIR));

// ==================== ROUTES ====================
app.use('/api/users', userRouter);
app.use('/api/hotels', hotelRouter);
app.use('/api/photos', photoRouter);
app.use('/api/chambres', chambreRouter);
app.use('/api/chambrephotos', chambrephotoRouter);
app.use('/api/reservations', reservationRouter);
app.use('/api/avis', avisRouter);

// Route migration temporaire (à supprimer plus tard)
app.get('/api/hotels/migrate-avis-now', async (req, res) => {
  // ... ton code existant
});

// Route d'accueil
app.get('/', (req, res) => {
  res.send('Bienvenue dans le système de réservation d’hôtels !');
});

app.get('/health', (req, res) => res.json({ status: 'OK', backend: 'Running' }));

// ==================== DB + ERREURS + LANCEMENT ====================
db();

app.use((err, req, res, next) => {
  console.error('Erreur globale capturée:', err.stack);
  res.status(500).json({
    message: 'Erreur serveur interne',
    error: err.message
  });
});

// --- Démarrage du serveur ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur lancé sur le port ${PORT}`);
});















// import express from 'express';
// import cors from 'cors';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import dotenv from 'dotenv';
// import fs from 'fs';  // Ajout pour créer dossier invoices si absent
// // --- Import des routes ---
// import userRouter from './routes/user.route.js';
// import hotelRouter from './routes/hotel.route.js';
// import photoRouter from './routes/photo.route.js';
// import chambreRouter from './routes/chambre.route.js';
// import chambrephotoRouter from './routes/chambrephoto.route.js';
// import reservationRouter from './routes/reservation.route.js';
// import avisRouter from './routes/avis.route.js';
// import db from './db/db.js';

// dotenv.config();

// console.log('Debug .env:', {
//   STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
//     ? 'Loaded (length ' + process.env.STRIPE_WEBHOOK_SECRET.length + ')'
//     : 'Missing'
// });

// // Création des variables __dirname et __filename pour modules ES
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Initialisation de l'application Express
// const app = express();

// // --- Configuration CORS ---
// const corsOptions = {
//   origin: 'http://localhost:5173',
//   methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true
// };
// app.use(cors(corsOptions));

// // --- Configuration du corps des requêtes ---
// app.use('/api/reservations/webhook', express.raw({ type: 'application/json' })); // Stripe webhook
// app.use(express.json({ limit: '10mb' })); // Pour JSON
// app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Pour form-data

// // --- Servir les fichiers statiques (images uploadées) avec CORS ---
// app.use('/uploads', (req, res, next) => {
//   console.log('Middleware /uploads hit:', req.url);  // Debug : log si appelé
//   res.header('Access-Control-Allow-Origin', 'http://localhost:5173');  // Frontend Vite
//   res.header('Access-Control-Allow-Methods', 'GET');
//   res.header('Access-Control-Allow-Headers', 'Content-Type');
//   next();
// }, express.static(path.join(__dirname, 'uploads')));

// // ← AJOUT : Créer dossier invoices si absent (pour PDFs)
// const invoicesDir = path.join(__dirname, 'invoices');
// if (!fs.existsSync(invoicesDir)) {
//   fs.mkdirSync(invoicesDir, { recursive: true });
//   console.log('Dossier /invoices créé automatiquement.');
// }

// // --- Route statique pour PDFs factures ---
// app.use('/invoices', (req, res, next) => {
//   console.log('Middleware /invoices hit:', req.url);  // Debug optionnel
//   res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
//   res.header('Access-Control-Allow-Methods', 'GET');
//   res.header('Access-Control-Allow-Headers', 'Content-Type');
//   next();
// }, express.static(invoicesDir));  // Serve les PDFs

// // --- Routes principales ---
// app.use('/api/users', userRouter);
// app.use('/api/hotels', hotelRouter);
// app.use('/api/photos', photoRouter);
// app.use('/api/chambres', chambreRouter);
// app.use('/api/chambrephotos', chambrephotoRouter);
// app.use('/api/reservations', reservationRouter);
// app.use('/api/avis', avisRouter);

// // --- Route d’accueil ---
// app.get('/', (req, res) => {
//   res.send('Bienvenue dans le système de réservation d’hôtels ! 🏨');
// });

// // --- Vérification de santé du backend ---
// app.get('/health', (req, res) => res.json({ status: 'OK', backend: 'Running' }));

// // --- Connexion à la base de données ---
// db();

// // --- Middleware global d’erreur ---
// app.use((err, req, res, next) => {
//   console.error('Erreur globale capturée:', err.stack);
//   res.status(500).json({
//     message: 'Erreur serveur interne',
//     error: err.message
//   });
// });

// // --- Démarrage du serveur ---
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`🚀 Serveur lancé sur le port ${PORT}`);
//   console.log(`📁 Dossiers statiques : /uploads (images) et /invoices (PDFs) disponibles.`);
// });




































































