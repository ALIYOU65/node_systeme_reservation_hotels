import { Router } from 'express';
import { addAvisToHotel, getAvisByHotelId } from '../controllers/hotel.controller.js'; 
import authMiddleware from '../middlewares/authMiddleware.js';

const router = Router();

// POST /api/avis (ajout général, mais lié à hôtel)
router.post('/', authMiddleware, addAvisToHotel);  // Utilise la fonction de hotel.controller

// GET /api/avis/hotel/:id (liste par hôtel)
router.get('/hotel/:id', getAvisByHotelId);

export default router;