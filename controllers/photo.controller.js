import Photo from '../models/photo.model.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import photoValidation from '../validations/photo.validation.js';

dotenv.config();

 const createPhotoBlock = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Aucun fichier envoyé' });
    }

    const images = req.files.map((file) => ({
      url: `${req.protocol}://${req.get('host')}/uploads/hotels/${encodeURIComponent(file.filename)}`,
    }));

    req.body.images = images;

    const { error } = photoValidation(req.body).photoCreate;
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const photoDoc = new Photo({
      nom: req.body.nom,
      alt: req.body.alt,
      images,
      created_by: req.user.id || req.user._id, // Associe le bloc au personnel
    });

    const saved = await photoDoc.save();
    return res.status(201).json(saved);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

  const updatePhotoBlock = async (req, res) => {
  try {
    const photoId = req.params.photoId;
    const photo = await Photo.findById(photoId);
    if (!photo) {
      return res.status(404).json({ message: 'Bloc Photo n\'existe pas' });
    }

    // Mise à jour des champs texte (nom et alt) si présents
    if (req.body.nom) {
      photo.nom = req.body.nom;
    }
    if (req.body.alt) {
      photo.alt = req.body.alt;
    }

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({
        url: `${req.protocol}://${req.get('host')}/uploads/hotels/${encodeURIComponent(file.filename)}`,
      }));
      photo.images = photo.images.concat(newImages);
    }

    // Sauvegarde
    const updated = await photo.save();
    return res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Suppression d'une image spécifique d'un bloc 
  const removeImageFromBlock = async (req, res) => {
  try {
    const photoId = req.params.photoId;
    const imageId = req.params.imageId;

    const photo = await Photo.findById(photoId);
    if (!photo) {
      return res.status(404).json({ message: 'Bloc Photo non trouvé' });
    }

    // Trouve l'image par _id dans le tableau images
    const imageIndex = photo.images.findIndex(img => img._id.toString() === imageId);
    if (imageIndex === -1) {
      return res.status(404).json({ message: 'Image non trouvée dans le bloc' });
    }

    // Supprime le fichier du disque
    const imageUrl = photo.images[imageIndex].url;
    let filePath = imageUrl.replace(process.env.BASE_URL + '/', '').replace(/\\/g, '/');
    fs.unlink(filePath, (err) => {
      if (err) console.error('Erreur suppression image :', err);
    });

    // Supprime l'image du tableau
    photo.images.splice(imageIndex, 1);

    // Sauvegarde le bloc mis à jour
    const updated = await photo.save();

    return res.status(200).json({
      message: 'Image supprimée du bloc',
      bloc: updated,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Suppression d'un bloc Photo entier (DELETE /photos/:photoId)
 const deletePhotoBlock = async (req, res) => {
  try {
    const photoId = req.params.photoId;
    const photo = await Photo.findById(photoId);
    if (!photo) {
      return res.status(404).json({ message: 'Bloc Photo n\'existe pas' });
    }

    // Supprime les fichiers images du disque (boucle sur images)
    for (const image of photo.images) {
      let filePath = image.url.replace(process.env.BASE_URL + '/', '').replace(/\\/g, '/');
      fs.unlink(filePath, (err) => {
        if (err) console.error('Erreur suppression image :', err);
      });
    }

    // Supprime le document Photo
    await Photo.findByIdAndDelete(photoId);

    res.status(200).json({ message: 'Bloc Photo supprimé' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Liste tous les blocs Photo 
const getAllPhotoBlocks = async (req, res) => {
  try {
    const photos = await Photo.find().sort({ createdAt: -1 }); // Tri par date récente

    // Mappe pour normalisation 
    const normalizedPhotos = photos.map(photo => {
      const normalizedImages = photo.images.map(image => {
        let normalizedUrl = image.url.replace(/\\/g, '/');
        if (!normalizedUrl.startsWith('http')) {
          normalizedUrl = `${process.env.BASE_URL}/${normalizedUrl}`;
        }
        return {
          ...image.toObject(),
          url: normalizedUrl,
        };
      });

      return {
        ...photo.toObject(),
        images: normalizedImages,
      };
    });

    return res.status(200).json(normalizedPhotos); 
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Récupère un bloc Photo par ID (GET /photos/:photoId)
const getPhotoBlockById = async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.photoId);

    if (!photo) return res.status(404).json({ message: 'Bloc Photo n\'existe pas' });

    // Normalisation images
    const normalizedImages = photo.images.map(image => {
      let normalizedUrl = image.url.replace(/\\/g, '/');
      if (!normalizedUrl.startsWith('http')) {
        normalizedUrl = `${process.env.BASE_URL}/${normalizedUrl}`;
      }
      return {
        ...image.toObject(),
        url: normalizedUrl,
      };
    });

    const response = {
      ...photo.toObject(),
      images: normalizedImages,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Récupère uniquement les blocs du personnel connecté
const getMyPhotoBlocks = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const photos = await Photo.find({ created_by: userId }).sort({ createdAt: -1 });

    const normalizedPhotos = photos.map(photo => {
      const normalizedImages = photo.images.map(image => {
        let normalizedUrl = image.url.replace(/\\/g, '/');
        if (!normalizedUrl.startsWith('http')) {
          normalizedUrl = `${process.env.BASE_URL}/${normalizedUrl}`;
        }
        return {
          ...image.toObject(),
          url: normalizedUrl,
        };
      });

      return {
        ...photo.toObject(),
        images: normalizedImages,
      };
    });

    return res.status(200).json(normalizedPhotos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

export { createPhotoBlock, updatePhotoBlock, deletePhotoBlock, getAllPhotoBlocks, getMyPhotoBlocks, getPhotoBlockById, removeImageFromBlock };