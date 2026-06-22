import { Router } from 'express';
import { createHotel, getAllHotels, getHotelById, updateHotel, deleteHotel, linkPhotoBlocksToHotel, validateHotel, addAvisToHotel, getAvisByHotelId, getMyHotels, approveAvis, rejectAvis, getPendingAvis } from '../controllers/hotel.controller.js';
import hotelValidation from '../validations/hotel.validation.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { rolesMiddleware } from '../middlewares/rolesMiddleware.js';
import { uploadPhoto } from '../middlewares/uploadMiddleware.js';

const router = Router();

// Route PUBLIQUE PRINCIPALE : Liste tous les hôtels (avec filtres validated=true, ville, etc.) – SÉCURISÉ : Optionnel auth pour plus de détails
router.get('/', getAllHotels);  

// Route PROTÉGÉE : Seulement pour PERSONNEL (ex: /hotels/my)
router.get('/my', authMiddleware, rolesMiddleware(['PERSONNEL']), getMyHotels);

// Dans hotel.routes.js → tu DOIS avoir cette ligne
router.get('/avis/pending', authMiddleware, rolesMiddleware(['MODERATEUR']), getPendingAvis);

// Routes pour modération avis (indépendantes – PUT /hotels/avis/:id/approve et /reject)
router.put('/avis/:id/approve', authMiddleware, rolesMiddleware(['MODERATEUR']), approveAvis);
router.put('/avis/:id/reject', authMiddleware, rolesMiddleware(['MODERATEUR']), rejectAvis);

// Routes dynamiques APRÈS
router.get('/:hotelId', getHotelById);  

// Création d'un hôtel (POST /hotels)
router.post('/', authMiddleware, rolesMiddleware(['PERSONNEL']), uploadPhoto,
  (req, res, next) => {
    console.log('Debug validation after Multer - Body:', req.body, 'Files:', req.files?.length);
    const { error } = hotelValidation(req.body, false).hotelCreate;
    if (error) {
      console.error('Validation error:', error.details[0].message);
      return res.status(400).json({ message: error.details[0].message });
    }
    next();
  },
  createHotel
);

// Mise à jour d'un hôtel (PUT /hotels/:hotelId)
router.put('/:hotelId', authMiddleware, rolesMiddleware(['PERSONNEL']), (req, res, next) => {
  const { error } = hotelValidation(req.body, true).hotelUpdate;
  if (error) return res.status(400).json({ message: error.details[0].message });
  next();
}, updateHotel);

// Suppression d'un hôtel (DELETE /hotels/:hotelId)
router.delete('/:hotelId', authMiddleware, rolesMiddleware(['PERSONNEL']), deleteHotel);

// Lien blocs Photo à hôtel (PUT /hotels/:hotelId/link-blocks)
router.post('/:hotelId/link-blocks', authMiddleware, rolesMiddleware(['PERSONNEL']), linkPhotoBlocksToHotel);

// Valider un hôtel (PUT /hotels/:id/validate – Seulement pour modérateur)
router.put('/:id/validate', authMiddleware, rolesMiddleware(['MODERATEUR']), validateHotel);

// AJOUT AVIS : Ajouter un avis (POST /hotels/:id/avis) – SÉCURISÉ : Limité à CLIENT/PERSONNEL
// router.post('/:id/avis', authMiddleware, rolesMiddleware(['CLIENT', 'PERSONNEL']), (req, res, next) => {  // ← FIX : + rolesMiddleware
//   const { note, commentaire } = req.body;
//   if (!note || !commentaire) return res.status(400).json({ message: 'Note et commentaire requis.' });
//   next();
// }, addAvisToHotel);
router.post('/:id/avis', authMiddleware, rolesMiddleware(['CLIENT']), addAvisToHotel );

// Lister avis d'un hôtel (GET /hotels/:id/avis) – SÉCURISÉ : Auth requise
router.get('/:id/avis', getAvisByHotelId);  

export default router;















// import { Router } from 'express';
// import { createHotel, getAllHotels, getHotelById, updateHotel, deleteHotel, linkPhotoBlocksToHotel, validateHotel, addAvisToHotel, getAvisByHotelId, getMyHotels } from '../controllers/hotel.controller.js';
// import hotelValidation from '../validations/hotel.validation.js';
// import authMiddleware from '../middlewares/authMiddleware.js';
// import { rolesMiddleware } from '../middlewares/rolesMiddleware.js';
// import { uploadPhoto } from '../middlewares/uploadMiddleware.js';

// const router = Router();

// // Route PUBLIQUE PRINCIPALE : Liste tous les hôtels (avec filtres validated=true, ville, etc.)
// router.get('/', getAllHotels);

// // Route PROTÉGÉE : Seulement pour PERSONNEL (ex: /hotels/my)
// router.get('/my', authMiddleware, rolesMiddleware(['PERSONNEL']), getMyHotels);  

// // Routes dynamiques APRÈS
// router.get('/:hotelId', getHotelById); // Récupère un hôtel par ID (publique)

// // Création d'un hôtel (POST /hotels)
// router.post('/', authMiddleware, rolesMiddleware(['PERSONNEL']), uploadPhoto,
//   (req, res, next) => {
//     console.log('Debug validation after Multer - Body:', req.body, 'Files:', req.files?.length);
//     const { error } = hotelValidation(req.body, false).hotelCreate;
//     if (error) {
//       console.error('Validation error:', error.details[0].message);
//       return res.status(400).json({ message: error.details[0].message });
//     }
//     next();
//   },
//   createHotel
// );

// // Mise à jour d'un hôtel (PUT /hotels/:hotelId)
// router.put('/:hotelId', authMiddleware, rolesMiddleware(['PERSONNEL']), (req, res, next) => {
//   const { error } = hotelValidation(req.body, true).hotelUpdate;
//   if (error) return res.status(400).json({ message: error.details[0].message });
//   next();
// }, updateHotel);

// // Suppression d'un hôtel (DELETE /hotels/:hotelId)
// router.delete('/:hotelId', authMiddleware, rolesMiddleware(['PERSONNEL']), deleteHotel);

// // Lien blocs Photo à hôtel (PUT /hotels/:hotelId/link-blocks)
// router.post('/:hotelId/link-blocks', authMiddleware, rolesMiddleware(['PERSONNEL']), linkPhotoBlocksToHotel);

// // Valider un hôtel (PUT /hotels/:id/validate – Seulement pour modérateur)
// router.put('/:id/validate', authMiddleware, rolesMiddleware(['MODERATEUR']), validateHotel);

// // AJOUT AVIS : Ajouter un avis (POST /hotels/:id/avis)
// router.post('/:id/avis', authMiddleware, (req, res, next) => {
//   const { note, commentaire } = req.body;
//   if (!note || !commentaire) return res.status(400).json({ message: 'Note et commentaire requis.' });
//   next();
// }, addAvisToHotel);

// // Lister avis d'un hôtel (GET /hotels/:id/avis)
// router.get('/:id/avis', getAvisByHotelId);

// export default router;


































