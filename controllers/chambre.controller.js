import mongoose from 'mongoose';
import Chambre from '../models/chambre.model.js';
import Hotel from '../models/hotel.model.js'; 
import ChambrePhoto from '../models/chambrephoto.model.js';
import chambreValidation from '../validations/chambre.validation.js';
import dotenv from 'dotenv';
dotenv.config();

// Création d'une chambre (POST /chambres – Associe à un hôtel)
const createChambre = async (req, res) => {
  try {
    // Validation déjà en route, mais double-check
    const { error } = chambreValidation(req.body, false).chambreCreate;
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // Vérifier que l'hôtel existe
    const hotel = await Hotel.findById(req.body.hotel);
    if (!hotel) {
      return res.status(404).json({ message: 'Hôtel non trouvé' });
    }

    const chambreDoc = new Chambre({
      type_chambre: req.body.type_chambre,
      capacite: req.body.capacite,
      prix_nuit: req.body.prix_nuit,
      etat: req.body.etat || 'Disponible',
      description: req.body.description,
      hotel: req.body.hotel,
      photos: req.body.photos || [],          
      reservations: req.body.reservations || []
    });

    const saved = await chambreDoc.save();

    // Populate hôtel pour réponse
    const savedWithHotel = await Chambre.findById(saved._id)
      .populate('hotel', 'nom adresse')     
      .populate({
        path: 'photos',
        model: 'ChambrePhoto'
      })
      .populate({
        path: 'reservations',
        model: 'Reservation'
      });

    // Ajouter l'ID chambre à l'hôtel (relation bidirectionnelle)
    await Hotel.findByIdAndUpdate(req.body.hotel, { $push: { chambres: saved._id } });

    return res.status(201).json(savedWithHotel);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

const getMyChambres = async (req, res) => {
  try {
     
    const userId = req.user.id; // Du middleware auth (JWT)
    console.log('🔍 getMyChambres - ID extrait:', userId); // Debug userId
    
    if (!userId) {
      console.error('❌ getMyChambres - Pas de userId (auth fail)');
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }
    
    // Récupérez les hôtels du personnel
    const hotelsPersonnel = await Hotel.find({ personnel: new mongoose.Types.ObjectId(userId) }).select('_id nom'); 
    
    if (hotelsPersonnel.length === 0) {
      console.log('🔍 Pas d\'hôtels pour ce personnel – Return []');
      return res.status(200).json([]); 
    }

    const hotelIds = hotelsPersonnel.map(h => h._id);
    
    // Filtre par hôtels du personnel (et optionnellement par hotelId)
    const { hotelId } = req.query; // Filtre optionnel
    let query = { hotel: { $in: hotelIds } }; // Filtre par hôtels du personnel
    
    if (hotelId) {
      const validHotelId = new mongoose.Types.ObjectId(hotelId);
      if (!hotelIds.some(id => id.equals(validHotelId))) {
        console.log('🔍 hotelId non autorisé:', hotelId);
        return res.status(403).json({ message: 'Hôtel non autorisé pour ce personnel' });
      }
      query = { hotel: validHotelId }; // Override sécurisé
    }
    
    const chambres = await Chambre.find(query)
      .populate('hotel', 'nom adresse')
      .populate({
        path: 'photos',
        populate: { path: 'images', select: 'url' }
      })
      .sort({ createdAt: -1 }); 
    
    console.log('🔍 Chambres trouvées:', chambres.length); 
    
    return res.status(200).json(chambres);
  } catch (error) {
    console.error('❌ Erreur getMyChambres:', error.message);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};


// Récupère une chambre par ID (GET /chambres/:chambreId)
const getChambreById = async (req, res) => {
  try {
    const { chambreId } = req.params;
    console.log("Fetch chambre ID :", chambreId);  // Log pour debug
    const chambre = await Chambre.findById(chambreId).populate('hotel', 'nom adresse').populate({
      path: 'photos',
      populate: { path: 'images', select: 'url' }  // FIX : Nested populate pour charger les URLs des images
    });

    if (!chambre) return res.status(404).json({ message: 'Chambre non trouvée' });
    console.log("Chambre trouvée avec photos :", chambre);  // Log pour debug
    return res.status(200).json(chambre);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Mise à jour d'une chambre (PUT /chambres/:chambreId)
const updateChambre = async (req, res) => {
  try {
    const { error } = chambreValidation(req.body, true).chambreUpdate;
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const chambreId = req.params.chambreId;
    const updateData = { ...req.body };
    const updated = await Chambre.findByIdAndUpdate(
      chambreId,
      updateData,
      { new: true }
    ).populate('hotel', 'nom adresse');

    if (!updated) return res.status(404).json({ message: 'Chambre non trouvée' });
    return res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Suppression d'une chambre (DELETE /chambres/:chambreId)
const deleteChambre = async (req, res) => {
  try {
    const chambreId = req.params.chambreId;
    const chambre = await Chambre.findById(chambreId);
    if (!chambre) return res.status(404).json({ message: 'Chambre non trouvée' });
    // Supprimer référence dans l'hôtel
    await Hotel.findByIdAndUpdate(chambre.hotel, { $pull: { chambres: chambreId } });
    await Chambre.findByIdAndDelete(chambreId);
    return res.status(200).json({ message: 'Chambre supprimée' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Lien blocs ChambrePhoto à chambre (PUT /chambres/:chambreId/link-blocks)
const linkPhotoBlocksToChambre = async (req, res) => {
  try {
    const { photoBlockIds } = req.body; // Array d'IDs blocs ChambrePhoto
    const chambreId = req.params.chambreId;
    const chambre = await Chambre.findById(chambreId);
    if (!chambre) return res.status(404).json({ message: 'Chambre non trouvée' });
    // Vérifier que les blocs existent
    const validBlocks = await ChambrePhoto.find({ _id: { $in: photoBlockIds } });
    if (validBlocks.length !== photoBlockIds.length) {
      return res.status(400).json({ message: 'Certains blocs ChambrePhoto n\'existent pas' });
    }
    // Push les IDs au tableau photos de la chambre
    await Chambre.findByIdAndUpdate(chambreId, { $push: { photos: { $each: photoBlockIds } } });
    // Réponse avec chambre + blocs liés populated
    const chambreWithPhotos = await Chambre.findById(chambreId).populate({
      path: 'photos',
      populate: { path: 'images', select: 'url' },  // Charge les URLs des images
    }).populate('hotel', 'nom adresse');
    res.status(200).json({
      message: `${photoBlockIds.length} bloc(s) ChambrePhoto lié(s) à la chambre`,
      chambre: chambreWithPhotos,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

export { createChambre, getMyChambres, getChambreById, updateChambre, deleteChambre, linkPhotoBlocksToChambre };



















































































































