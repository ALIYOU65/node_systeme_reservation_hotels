import { Router } from 'express';
import { 
  createPhotoBlock, 
  updatePhotoBlock, 
  deletePhotoBlock, 
  getAllPhotoBlocks, 
  getMyPhotoBlocks, 
  getPhotoBlockById, 
  removeImageFromBlock 
} from '../controllers/photo.controller.js';
import photoValidation from '../validations/photo.validation.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { rolesMiddleware } from '../middlewares/rolesMiddleware.js';
import { uploadPhoto } from '../middlewares/multer.js';

const router = Router();

// Récupérer uniquement les photos du personnel connecté
router.get('/my', authMiddleware, rolesMiddleware(['PERSONNEL']), getMyPhotoBlocks);

// Liste tous les blocs Photo (Admin / Global)
router.get('/all', authMiddleware, rolesMiddleware(['PERSONNEL']), getAllPhotoBlocks);

router.get('/:photoId', authMiddleware, rolesMiddleware(['PERSONNEL']), getPhotoBlockById);
router.post('/', authMiddleware, rolesMiddleware(['PERSONNEL']), uploadPhoto, createPhotoBlock);
router.put('/:photoId', authMiddleware, rolesMiddleware(['PERSONNEL']), uploadPhoto, (req, res, next) => {
  const { error } = photoValidation(req.body).photoUpdate;
  if (error) return res.status(400).json({ message: error.details[0].message });
  next();
}, updatePhotoBlock);
router.put('/:photoId/remove-image/:imageId', authMiddleware, rolesMiddleware(['PERSONNEL']), removeImageFromBlock);
router.delete('/:photoId', authMiddleware, rolesMiddleware(['PERSONNEL']), deletePhotoBlock);

export default router;



