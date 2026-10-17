import mongoose from 'mongoose';

const imageSubSchema = new mongoose.Schema({
  url: { type: String, required: true },
}, { _id: true }); // _id auto pour chaque image

const chambrePhotoSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true, // Titre du bloc (ex. "Vue sur le lit")
  },
  alt: {
    type: String, // Description du bloc pour accessibilité
  },
  images: [imageSubSchema], // Tableau d'images
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
    required: true,
  },
}, { timestamps: true });

// export default mongoose.model('ChambrePhoto', chambrePhotoSchema);
export default mongoose.models.ChambrePhoto || mongoose.model('ChambrePhoto', chambrePhotoSchema);

