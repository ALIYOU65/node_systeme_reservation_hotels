import { Router } from 'express';
import { createChambre, getMyChambres, getChambreById, updateChambre, deleteChambre, linkPhotoBlocksToChambre } from '../controllers/chambre.controller.js';
import chambreValidation from '../validations/chambre.validation.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { rolesMiddleware } from '../middlewares/rolesMiddleware.js';
import { uploadPhoto } from '../middlewares/multer.js';

const router = Router();

// l'endpoint '/my' qui est plus explicite sur le filtrage par utilisateur
router.get('/my', authMiddleware, rolesMiddleware(['PERSONNEL']), getMyChambres);

// Route STATIQUE d'ABORD : /all (protégée PERSONNEL) – Évite capture par :chambreId
// router.get('/all', authMiddleware, rolesMiddleware(['PERSONNEL']), getAllChambres);

// Route DYNAMIQUE APRÈS : Détails une chambre par ID (publique ou protégée selon besoin)
router.get('/:chambreId', getChambreById); // Publique pour visiteurs/clients

// Création d'une chambre (validation en middleware, avec upload)
router.post('/', authMiddleware, rolesMiddleware(['PERSONNEL']), uploadPhoto, (req, res, next) => {
  const { error } = chambreValidation(req.body, false).chambreCreate;
  if (error) return res.status(400).json({ message: error.details[0].message });
  next();
}, createChambre);

// Mise à jour d'une chambre (validation en middleware, avec upload)
router.put('/:chambreId', authMiddleware, rolesMiddleware(['PERSONNEL']), uploadPhoto, (req, res, next) => {
  const { error } = chambreValidation(req.body, true).chambreUpdate;
  if (error) return res.status(400).json({ message: error.details[0].message });
  next();
}, updateChambre);

// Suppression d'une chambre
router.delete('/:chambreId', authMiddleware, rolesMiddleware(['PERSONNEL']), deleteChambre);

// Lien d'un ou plusieurs blocs ChambrePhoto à une chambre (validation simple en middleware)
router.put('/:chambreId/link-blocks', authMiddleware, rolesMiddleware(['PERSONNEL']), (req, res, next) => {
  const { error } = Joi.object({ photoBlockIds: Joi.array().items(Joi.string()).required() }).validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  next();
}, linkPhotoBlocksToChambre);

export default router;




















// import { Router } from 'express';
// import { createChambre, getAllChambres, getChambreById, updateChambre, deleteChambre, linkPhotoBlocksToChambre } from '../controllers/chambre.controller.js';
// import chambreValidation from '../validations/chambre.validation.js';
// import authMiddleware from '../middlewares/authMiddleware.js';
// import { rolesMiddleware } from '../middlewares/rolesMiddleware.js';
// import { uploadPhoto } from '../middlewares/multer.js';

// const router = Router();

// // Route PUBLIQUE : Détails une chambre par ID (première pour matcher /:chambreId sans auth)
// router.get('/:chambreId', getChambreById); // ✅ Publique pour visiteurs/clients

// // Route pour toutes les chambres (protégée pour PERSONNEL, ex: dashboard)
// router.get('/all', authMiddleware, rolesMiddleware(['PERSONNEL']), getAllChambres);

// // Création d'une chambre (validation en middleware, avec upload)
// router.post('/', authMiddleware, rolesMiddleware(['PERSONNEL']), uploadPhoto, (req, res, next) => {
//   const { error } = chambreValidation(req.body, false).chambreCreate;
//   if (error) return res.status(400).json({ message: error.details[0].message });
//   next();
// }, createChambre);

// // Mise à jour d'une chambre (validation en middleware, avec upload)
// router.put('/:chambreId', authMiddleware, rolesMiddleware(['PERSONNEL']), uploadPhoto, (req, res, next) => {
//   const { error } = chambreValidation(req.body, true).chambreUpdate;
//   if (error) return res.status(400).json({ message: error.details[0].message });
//   next();
// }, updateChambre);

// // Suppression d'une chambre
// router.delete('/:chambreId', authMiddleware, rolesMiddleware(['PERSONNEL']), deleteChambre);

// // Lien d'un ou plusieurs blocs ChambrePhoto à une chambre (validation simple en middleware)
// router.put('/:chambreId/link-blocks', authMiddleware, rolesMiddleware(['PERSONNEL']), (req, res, next) => {
//   const { error } = Joi.object({ photoBlockIds: Joi.array().items(Joi.string()).required() }).validate(req.body);
//   if (error) return res.status(400).json({ message: error.details[0].message });
//   next();
// }, linkPhotoBlocksToChambre);

// export default router;































// import { Router } from 'express';
// import { createChambre, getAllChambres, getChambreById, updateChambre, deleteChambre, linkPhotoBlocksToChambre } from '../controllers/chambre.controller.js';
// import chambreValidation from '../validations/chambre.validation.js';
// import authMiddleware from '../middlewares/authMiddleware.js';
// import { rolesMiddleware } from '../middlewares/rolesMiddleware.js';
// import { uploadPhoto } from '../middlewares/multer.js'; 


// const router = Router();

// // Liste toutes (filtre optionnel par hôtel via query)
// router.get('/all', authMiddleware, rolesMiddleware(['PERSONNEL']), getAllChambres); 

// // Création d'une chambre (validation en middleware, avec upload)
// router.post('/', authMiddleware, rolesMiddleware(['PERSONNEL']), uploadPhoto, (req, res, next) => {
//   const { error } = chambreValidation(req.body, false).chambreCreate;
//   if (error) return res.status(400).json({ message: error.details[0].message });
//   next();
// }, createChambre);

// // Récupère une chambre par ID
// router.get('/:chambreId', authMiddleware, rolesMiddleware(['PERSONNEL']), getChambreById);

// // Mise à jour d'une chambre (validation en middleware, avec upload)
// router.put('/:chambreId', authMiddleware, rolesMiddleware(['PERSONNEL']), uploadPhoto, (req, res, next) => {
//   const { error } = chambreValidation(req.body, true).chambreUpdate;
//   if (error) return res.status(400).json({ message: error.details[0].message });
//   next();
// }, updateChambre);

// // Suppression d'une chambre
// router.delete('/:chambreId', authMiddleware, rolesMiddleware(['PERSONNEL']), deleteChambre);

// //Lien d'un ou plusieurs blocs ChambrePhoto à une chambre (validation simple en middleware)
// router.put('/:chambreId/link-blocks', authMiddleware, rolesMiddleware(['PERSONNEL']), (req, res, next) => {
//   const { error } = Joi.object({ photoBlockIds: Joi.array().items(Joi.string()).required() }).validate(req.body);
//   if (error) return res.status(400).json({ message: error.details[0].message });
//   next();
// }, linkPhotoBlocksToChambre);
// export default router;















