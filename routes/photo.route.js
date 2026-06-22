import { Router } from 'express';
import { createPhotoBlock, updatePhotoBlock, deletePhotoBlock, getAllPhotoBlocks, getPhotoBlockById, removeImageFromBlock } from '../controllers/photo.controller.js';
import photoValidation from '../validations/photo.validation.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { rolesMiddleware } from '../middlewares/rolesMiddleware.js';
import { uploadPhoto } from '../middlewares/multer.js';

const router = Router();

// Liste tous les blocs Photo (format ancien : array de blocs avec images[])
router.get('/all', authMiddleware, rolesMiddleware(['PERSONNEL']), getAllPhotoBlocks);

// Récupère un bloc Photo par ID
router.get('/:photoId', authMiddleware, rolesMiddleware(['PERSONNEL']), getPhotoBlockById);

// Création d'un bloc Photo avec images (POST /photos)
router.post('/', authMiddleware, rolesMiddleware(['PERSONNEL']), uploadPhoto, createPhotoBlock);

// Mise à jour d'un bloc Photo (PUT /photos/:photoId) – Ajoute images si upload
router.put('/:photoId', authMiddleware, rolesMiddleware(['PERSONNEL']), uploadPhoto, (req, res, next) => {
  const { error } = photoValidation(req.body).photoUpdate;
  if (error) return res.status(400).json({ message: error.details[0].message });
  next();
}, updatePhotoBlock);

// Suppression d'une image spécifique d'un bloc (PUT /photos/:photoId/remove-image/:imageId)
router.put('/:photoId/remove-image/:imageId', authMiddleware, rolesMiddleware(['PERSONNEL']), removeImageFromBlock);

// Suppression d'un bloc Photo entier
router.delete('/:photoId', authMiddleware, rolesMiddleware(['PERSONNEL']), deletePhotoBlock);

export default router;