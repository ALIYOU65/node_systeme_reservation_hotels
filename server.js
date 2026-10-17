import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose'; 

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

// dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// MIDDLEWARES GLOBAUX =
// CORS
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

// Body parsing 
app.use('/api/reservations/webhook', express.raw({ type: 'application/json' })); // Stripe webhook
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Fichiers statiques 
app.use('/uploads', (req, res, next) => {
  console.log('Middleware /uploads hit:', req.url);
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
}, express.static(path.join(__dirname, 'uploads')));

const FACTURES_DIR = path.resolve('factures');  
console.log('Dossier factures servi depuis :', FACTURES_DIR);
app.use('/factures', express.static(FACTURES_DIR));

// ROUTES
app.use('/api/users', userRouter);
app.use('/api/hotels', hotelRouter);
app.use('/api/photos', photoRouter);
app.use('/api/chambres', chambreRouter);
app.use('/api/chambrephotos', chambrephotoRouter);
app.use('/api/reservations', reservationRouter);
app.use('/api/avis', avisRouter);

// Route d'accueil
app.get('/', (req, res) => {
  res.send('Bienvenue dans le système de réservation d’hôtels !');
});

app.get('/health', (req, res) => res.json({ status: 'OK', backend: 'Running' }));

// DB + ERREURS + LANCEMENT
db();

app.use((err, req, res, next) => {
  console.error('Erreur globale capturée:', err.stack);
  res.status(500).json({
    message: 'Erreur serveur interne',
    error: err.message
  });
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur lancé sur le port ${PORT}`);
});

















































































