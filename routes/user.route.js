import { Router } from "express";
import { register, login, getAllUsers, getUserById, updateUser, deleteUser } from "../controllers/user.controller.js"
import authMiddleware from "../middlewares/authMiddleware.js";
import { rolesMiddleware } from "../middlewares/rolesMiddleware.js"; 

const router = Router()

// Routes publiques pour l'inscription et la connexion
router.post('/register', register);
router.post('/login', login);

// Route pour lister tous les utilisateurs : auth + rôles admin/modérateur
router.get('/all', authMiddleware, rolesMiddleware(['ADMIN', 'MODERATEUR']), getAllUsers);

// Routes pour un utilisateur spécifique :
// get/:id protégé par auth (profil personnel)
router.get('/:id', authMiddleware, getUserById);
// PUT/DELETE : auth + rôles (seul admin/modérateur peut modifier/supprimer)
router.put('/:id', authMiddleware, rolesMiddleware(['ADMIN', 'MODERATEUR']), updateUser);
router.delete('/:id', authMiddleware, rolesMiddleware(['ADMIN', 'MODERATEUR']), deleteUser);

export default router;