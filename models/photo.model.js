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
  images: [imageSubSchema], // Tableau d'images
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
    required: true,
  },
}, { timestamps: true });

// export default mongoose.model('Photo', photoSchema);
export default mongoose.models.Photo || mongoose.model('Photo', photoSchema);
