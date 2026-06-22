import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// Regex conforme à ma politique de sécurité
const passwordRegex = 
/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~])[A-Za-z\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~éèê]{10,}$/;

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/^\S+@\S+\.\S+$/, "Email invalide"],
  },
  password: {
    type: String,
    required: true,
    validate: {
      validator: function (value) {
        return passwordRegex.test(value);
      },
      message:
        "Le mot de passe doit contenir au moins 10 caractères, une majuscule, une minuscule, un chiffre, un caractère spécial, et peut inclure é, è, ê.",
    },
  },
  prenom: {
    type: String,
    required: true,
  },
  nom: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["CLIENT", "MODERATEUR", "PERSONNEL"],
    default: "CLIENT",
  },
  dateInscription: {
    type: Date,
    default: Date.now,
    required: true,
  },
}, { timestamps: true });

// Hash automatique avant sauvegarde
userSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

// Hash aussi lors des mises à jour avec password
userSchema.pre("findOneAndUpdate", async function () {
  const update = this.getUpdate();
  if (update.password) {
    // Vérifie d'abord que le nouveau mot de passe respecte la regex
    if (!passwordRegex.test(update.password)) {
      throw new Error(
        "Le mot de passe doit contenir au moins 10 caractères, une majuscule, une minuscule, un chiffre, un caractère spécial, et peut inclure é, è, ê."
      );
    }
    const hashed = await bcrypt.hash(update.password, 10);
    this.setUpdate({ ...update, password: hashed });
  }
});

// Méthode pour comparaison lors du login
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

export default mongoose.model('User', userSchema);
