import Hotel from '../models/hotel.model.js';
import Photo from '../models/photo.model.js';
import Avis from '../models/avis.model.js';
import hotelValidation from '../validations/hotel.validation.js';
import dotenv from 'dotenv';
// import Chambre from '../models/chambre.model.js';

dotenv.config();

/**
 * 🏨 Créer un hôtel (avec validation + photos + personnel)
 */
const createHotel = async (req, res) => {
  try {
    // Debug : affichage du corps de la requête (utile en développement)
    console.log('Debug createHotel - Body:', req.body);

    // Debug : vérifie si des fichiers (photos) ont bien été uploadés via multer
    console.log('Debug createHotel - Files:', req.files ? req.files.length : 0);

    // Validation des données texte avec le schéma Joi (hotelCreate)
    // false = pas de mise à jour (création uniquement)
    const { error } = hotelValidation(req.body, false).hotelCreate;

    // Si erreur de validation (ex: nom manquant, étoiles non numérique, etc.)
    if (error) {
      console.error('Validation error:', error.details[0].message);
      return res.status(400).json({ message: error.details[0].message });
    }

    // Déstructuration des champs obligatoires provenant du formulaire
    const { nom, adresse, description, etoiles, prix } = req.body;

    // Création du document Hôtel dans MongoDB
    const hotelDoc = new Hotel({
      nom,
      adresse,
      description,
      etoiles: Number(etoiles),           // Conversion explicite en nombre
      prix: Number(prix),                 // Prix de base ou par nuit (selon ta logique)
      
      // Lien avec le personnel connecté (propriétaire de l'hôtel)
      personnel: req.user.id,             // req.user provient du middleware protect

      // Gestion des photos : on combine les URLs déjà présentes (ex: via lien externe)
      // + les nouvelles photos uploadées via multer
      photos: [
        ...(req.body.photos || []),       // Photos ajoutées manuellement (liens externes)
        ...(req.files 
          ? req.files.map(f => ({ 
              url: `/uploads/hotels/${f.filename}`   // Chemin local servi par Express.static
            })) 
          : []
        )
      ],

      // Chambres éventuellement créées en même temps (optionnel)
      chambres: req.body.chambres || [],

      // Hôtel créé mais pas encore visible publiquement
      validated: false                    // En attente de validation par un modérateur
    });

    // Debug avant insertion en base
    console.log('Hôtel avant save:', hotelDoc);

    // Sauvegarde effective dans MongoDB
    const saved = await hotelDoc.save();

    // Récupération de l'hôtel créé avec population complète des références
    // (photos → images, chambres → photos → images) pour renvoyer une réponse riche
    const savedWithPhotos = await Hotel.findById(saved._id)
      .populate({
        path: 'photos',
        populate: { path: 'images', select: 'url' }   // Si tu as un sous-modèle Image
      })
      .populate({
        path: 'chambres',
        populate: {
          path: 'photos',
          populate: { path: 'images', select: 'url' }
        }
      });

    // Debug final : hôtel complet avec toutes les données enrichies
    console.log('Hôtel créé:', savedWithPhotos);

    // Réponse succès : statut 201 (Created) + données complètes de l'hôtel
    return res.status(201).json(savedWithPhotos);

  } catch (error) {
    // Capture de toute erreur inattendue (base de données, multer, etc.)
    console.error('Erreur createHotel:', error);
    
    // Réponse standardisée d'erreur serveur
    return res.status(500).json({ 
      message: 'Erreur serveur', 
      error: error.message 
    });
  }
};

/**
 * 📋 Lister tous les hôtels (avec chambres, photos et avis)
 */
const getAllHotels = async (req, res) => {
  try {
    const hotels = await Hotel.find()
      .populate({
        path: 'photos',
        populate: { path: 'images', select: 'url' }
      })
      .populate({
        path: 'chambres',
        populate: {
          path: 'photos',
          populate: { path: 'images', select: 'url' }
        }
      })
      .populate('avis');

    return res.status(200).json(hotels);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

/**
 * 🔍 Récupérer un hôtel par ID (avec photos, chambres, avis)
 */
const getHotelById = async (req, res) => {
  try {
    console.log("Fetch hôtel ID :", req.params.hotelId);

    const hotel = await Hotel.findById(req.params.hotelId)
      .populate({
        path: 'photos',
        populate: { path: 'images', select: 'url' }
      })
      .populate({
        path: 'chambres',
        populate: {
          path: 'photos',
          populate: { path: 'images', select: 'url' }
        }
      })
      .populate({
      path: 'avis',
      populate: {
      path: 'user',
      select: 'prenom nom'
    }
   })
    if (!hotel) {
      console.log("Hôtel non trouvé pour ID :", req.params.hotelId);
      return res.status(404).json({ message: 'Hôtel non trouvé' });
    }

    console.log("Hôtel trouvé :", hotel);
    return res.status(200).json(hotel);
  } catch (error) {
    console.error("Erreur getHotelById :", error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

/**
 * ✏️ Mise à jour d’un hôtel
 */
const updateHotel = async (req, res) => {
  try {
    const { error } = hotelValidation(req.body, true).hotelUpdate;
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    const hotelId = req.params.hotelId;
    const updateData = { ...req.body };
    const updated = await Hotel.findByIdAndUpdate(hotelId, updateData, { new: true })
      .populate({
        path: 'photos',
        populate: { path: 'images', select: 'url' }
      });
    if (!updated) return res.status(404).json({ message: 'Hôtel non trouvé' });
    return res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

/**
 * ❌ Suppression d’un hôtel
 */
const deleteHotel = async (req, res) => {
  try {
    const hotelId = req.params.hotelId;
    const hotel = await Hotel.findById(hotelId);

    if (!hotel) return res.status(404).json({ message: 'Hôtel non trouvé' });

    await Hotel.findByIdAndDelete(hotelId);

    return res.status(200).json({ message: 'Hôtel supprimé' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

/**
 * 🖼️ Lier des blocs photo à un hôtel
 */
const linkPhotoBlocksToHotel = async (req, res) => {
  try {
    const { photoBlockIds } = req.body;
    const hotelId = req.params.hotelId;

    const hotel = await Hotel.findById(hotelId);
    if (!hotel) return res.status(404).json({ message: 'Hôtel non trouvé' });

    const validBlocks = await Photo.find({ _id: { $in: photoBlockIds } });
    if (validBlocks.length !== photoBlockIds.length) {
      return res.status(400).json({ message: 'Certains blocs Photo n’existent pas' });
    }

    await Hotel.findByIdAndUpdate(hotelId, { $push: { photos: { $each: photoBlockIds } } });

    const hotelWithPhotos = await Hotel.findById(hotelId)
      .populate({
        path: 'photos',
        populate: { path: 'images', select: 'url' }
      });

    res.status(200).json({
      message: `${photoBlockIds.length} bloc(s) Photo lié(s) à l'hôtel`,
      hotel: hotelWithPhotos,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

/**
 * ✅ Validation d’un hôtel par un modérateur
 */
const validateHotel = async (req, res) => {
  try {
    const { id } = req.params;

    // Utilisation de findByIdAndUpdate pour modifier seulement les champs de validation
    const updated = await Hotel.findByIdAndUpdate(
      id,
      { 
        $set: {
          validated: true,
          validatedBy: req.user.id, // Utilisé directement, pas besoin de userId si c'est déjà dans req.user.id
          validatedAt: new Date()
        } 
      },
      { new: true, runValidators: true } // Utiliser { new: true } pour obtenir le document mis à jour
    )
    .populate('validatedBy', 'nom prenom')
    .populate({
        path: 'photos',
        populate: { path: 'images', select: 'url' }
    });

    if (!updated) return res.status(404).json({ message: 'Hôtel non trouvé après la mise à jour' });

    res.status(200).json({ message: 'Hôtel validé avec succès', hotel: updated });
  } catch (error) {
    console.error("Erreur validateHotel:", error);
    res.status(500).json({ message: 'Erreur lors de la validation', error: error.message });
  }
};

const addAvisToHotel = async (req, res) => {
  try {
    const { id: hotelId } = req.params;
    const { note, commentaire } = req.body;

    console.log("req.user dans addAvisToHotel :", req.user); // DEBUG À LAISSER

    // Vérifications critiques
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }
    if (!note || !commentaire?.trim()) {
      return res.status(400).json({ message: "Note et commentaire requis" });
    }

    // Création de l'avis
    const nouvelAvis = new Avis({
      hotel: hotelId,
      user: req.user.id,           // ICI : req.user.id (ou req.user._id si tu utilises _id)
      note: Number(note),
      commentaire: commentaire.trim(),
      status: 'pending'
    });

    await nouvelAvis.save();

    // Ajout à l'hôtel
    await Hotel.findByIdAndUpdate(hotelId, {
      $push: { avis: nouvelAvis._id }
    });

    res.status(201).json({
      message: "Avis envoyé ! En attente de modération.",
      avis: nouvelAvis
    });

  } catch (err) {
    console.error("Erreur ajout avis :", err);
    res.status(500).json({
      message: "Erreur lors de l'ajout de l'avis",
      error: err.message
    });
  }
};

/**
 * 📝 Récupérer les avis d’un hôtel
 */
const getAvisByHotelId = async (req, res) => {
  try {
    const { id } = req.params;
    const hotel = await Hotel.findById(id).populate({
      path: 'avis',  // CORRECTION : Populate direct sur array 'avis' de Hotel
      populate: { path: 'user', select: 'nom prenom' },  // Optionnel : Nom user pour avis
      match: { status: 'approved' } // ← affiche SEULEMENT les avis approuvés
    });
    if (!hotel) return res.status(404).json({ message: 'Hôtel non trouvé' });

    const avisList = hotel.avis || [];  // Fallback array vide si pas d'avis
    console.log(`[DEBUG] ${avisList.length} avis pour hôtel ${id}`);
    res.status(200).json(avisList);
  } catch (error) {
    console.error("[ERREUR] getAvisByHotelId :", error.message);
    res.status(500).json({ message: 'Erreur liste avis', error: error.message });
  }
};

/**
 * 👨‍💼 Récupérer les hôtels d’un personnel connecté
 */
const getMyHotels = async (req, res) => {
  try {
    if (req.user.role !== 'PERSONNEL') {
      return res.status(403).json({ message: 'Accès refusé - rôle PERSONNEL requis' });
    }

    const hotels = await Hotel.find({ personnel: req.user.id })
      .populate({
        path: 'photos',
        populate: { path: 'images', select: 'url' }
      })
      .populate({
        path: 'chambres',
        populate: {
          path: 'photos',
          populate: { path: 'images', select: 'url' }
        }
      })
      .populate('avis')
      .sort({ createdAt: -1 });

    res.json(hotels);
  } catch (error) {
    console.error("Erreur getMyHotels :", error);
    res.status(500).json({ message: 'Erreur chargement hôtels', error: error.message });
  }
};

/**
 * ✅ Approuver un avis par un modérateur
 */
const approveAvis = async (req, res) => {
  try {
    const { id } = req.params;  // avisId
    const avis = await Avis.findByIdAndUpdate(
      id, 
      { status: 'approved' },  // Change status
      { new: true }  // Renvoie l'avis mis à jour
    ).select('-__v');  // Optionnel : Exclut champs inutiles

    if (!avis) {
      return res.status(404).json({ message: 'Avis non trouvé' });
    }

    // Optionnel : Log pour tracer
    console.log(`[DEBUG] Avis ${id} approuvé par ${req.user.id}`);

    res.status(200).json({ 
      message: 'Avis approuvé avec succès', 
      avis: avis 
    });
  } catch (error) {
    console.error('Erreur approve avis:', error);
    res.status(500).json({ message: 'Erreur serveur lors de l\'approbation', error: error.message });
  }
};

/**
 * ❌ Rejeter un avis par un modérateur
 */
const rejectAvis = async (req, res) => {
  try {
    const { id } = req.params;
    const avis = await Avis.findByIdAndUpdate(
      id, 
      { status: 'rejected' },
      { new: true }
    ).select('-__v');

    if (!avis) {
      return res.status(404).json({ message: 'Avis non trouvé' });
    }

    // Optionnel : Log pour tracer
    console.log(`[DEBUG] Avis ${id} rejeté par ${req.user.id}`);

    res.status(200).json({ 
      message: 'Avis rejeté avec succès', 
      avis: avis 
    });
  } catch (error) {
    console.error('Erreur reject avis:', error);
    res.status(500).json({ message: 'Erreur serveur lors du rejet', error: error.message });
  }
};

/**
 * Récupérer tous les avis en attente de modération
 */
const getPendingAvis = async (req, res) => {
  try {
    console.log('[MODERATION] Récupération des avis pending...');
    const avis = await Avis.find({ status: 'pending' })
      .populate('hotel', 'nom')
      .populate('user', 'prenom nom email')
      .sort({ createdAt: -1 });

    console.log(`[MODERATION] ${avis.length} avis en attente trouvés`);
    res.status(200).json(avis);
  } catch (error) {
    console.error('Erreur getPendingAvis:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des avis' });
  }
};

export { createHotel, getAllHotels, getHotelById, updateHotel, deleteHotel, linkPhotoBlocksToHotel, validateHotel, 
  addAvisToHotel, getAvisByHotelId, getMyHotels, approveAvis, rejectAvis, getPendingAvis };


































