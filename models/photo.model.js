import mongoose from 'mongoose';

const imageSubSchema = new mongoose.Schema({
  url: { type: String, required: true },
}, { _id: true }); // _id auto pour chaque image

const photoSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true, // Titre du bloc (ex. "Vue extérieure")
  },
  alt: {
    type: String, // Description du bloc
  },
  images: [imageSubSchema], // Tableau d'images comme ancien (seulement url)
}, { timestamps: true });

export default mongoose.model('Photo', photoSchema);