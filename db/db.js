import mongoose from "mongoose";

const db = async () => {
try {
await mongoose.connect(process.env.DB_URI);
console.log("✅ MongoDB connecté !");
} catch (error) {
console.error("Erreur de connexion :", error.message);
process.exit(1);
}
};

export default db;