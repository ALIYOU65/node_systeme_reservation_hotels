import User from "../models/user.model.js"
import userValidation from "../validations/user.validation.js"
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

const register = async (req, res) => {
  try {
    const { body } = req; // Récupération du corps de la requête (données envoyées par le frontend)

    // Vérification que le corps de la requête existe et n'est pas vide
    if (!body) {
      return res.status(400).json({ message: "Pas de données dans la requête" });
    }

    // Validation des données avec Joi (userValidation est un schéma prédéfini)
    // userCreate correspond au schéma de validation pour la création d'utilisateur
    const { error } = userValidation(body).userCreate;

    // Si Joi détecte une erreur de validation (ex: email invalide, mot de passe trop court...)
    if (error) {
      return res.status(400).json({ message: error.details[0].message }); // On renvoie le premier message d'erreur clair
    }

    // Recherche en base pour vérifier si l'email est déjà utilisé
    const searchUser = await User.findOne({ email: body.email });

    // Si un utilisateur existe déjà avec cet email → conflit
    if (searchUser) {
      return res.status(409).json({ message: "L'utilisateur existe déjà" });
    }

    // Déstructuration des champs nécessaires depuis le body validé
    const { prenom, nom, email, password } = body;

    // Création d'une nouvelle instance du modèle User
    const user = new User({
      prenom,                   
      nom,                       
      email,                     
      password,                  
      role: 'CLIENT'            
    });

    // Sauvegarde effective de l'utilisateur dans MongoDB
    const newUser = await user.save();

    // Génération du token JWT pour authentification immédiate après inscription
    const token = jwt.sign(
      {
        id: newUser._id,        
        email: newUser.email,   
        role: newUser.role      // Rôle transmis dans le token pour gestion des autorisations côté frontend/backend
      },
      process.env.SECRET_KEY,   // Clé secrète stockée dans les variables d'environnement
      { expiresIn: "24h" }     
    );

    // On retire le mot de passe de la réponse (même s'il est hashé, on ne l'envoie jamais au client)
    const { password: _, ...userResponse } = newUser.toObject();

    // Réponse réussie : statut 201 (Created) avec les données utilisateur + token
    return res.status(201).json({
      user: userResponse,  // Toutes les infos de l'utilisateur sauf le mot de passe
      token                // Token JWT pour connexion automatique
    });

  } catch (error) {
    // Gestion centrale des erreurs inattendues (erreur base de données, serveur, etc.)
    console.log(error); // Log côté serveur pour débogage
    res.status(500).json({ 
      message: "Erreur serveur", 
      error: error.message   // On renvoie le message d'erreur (à désactiver en production si sensible)
    });
  }
};

const login = async (req, res) => {
  try {
    // Récupération des champs email et password depuis le corps de la requête
    const { email, password } = req.body;

    // Validation des données d'entrée avec Joi (schéma userLogin défini dans userValidation)
    const { error } = userValidation(req.body).userLogin;

    // Si la validation échoue (ex: email mal formé, mot de passe manquant ou trop court)
    if (error) {
      return res
        .status(400)
        .json({ message: error.details[0].message }); // Message clair renvoyé au frontend
    }

    // Recherche de l'utilisateur en base par son email
    const user = await User.findOne({ email: email });

    // Si aucun utilisateur trouvé avec cet email → on ne précise pas si c'est l'email ou le mdp qui est faux (sécurité)
    if (!user) {
      return res.status(400).json({ message: "Identifiants invalides" });
    }

    // Comparaison du mot de passe envoyé avec celui hashé en base
    // (méthode comparePassword définie dans le schéma User via un pre-save + bcrypt)
    const isMatch = await user.comparePassword(password);

    // Si les mots de passe ne correspondent pas → même message générique pour éviter le timing attack
    if (!isMatch) {
      return res.status(400).json({ message: "Identifiants invalides" });
    }

    // Suppression du champ password de l'objet utilisateur avant envoi au client
    // (même hashé, on ne l'envoie jamais dans la réponse)
    const { password: _, ...userResponse } = user.toObject();

    // Génération du token JWT signé avec les informations essentielles
    const token = jwt.sign(
      {
        id: user._id,          // ID unique pour identifier l'utilisateur
        email: user.email,     // Email (utile côté frontend)
        role: user.role        // Rôle très important pour la gestion des autorisations
      },
      process.env.SECRET_KEY,  // Clé secrète stockée dans .env (jamais en dur !)
      { expiresIn: "24h" }     // Expiration du token après 24 heures
    );

    // Réponse de succès : statut 200 + message personnalisé + données utilisateur + token
    res.status(200).json({
      message: `${user.email} est connecté`,   // Message convivial pour le frontend
      user: userResponse,                      // Infos utilisateur sans mot de passe
      token                                    // Token à stocker côté client (localStorage ou httpOnly cookie)
    });

  } catch (error) {
    // Capture de toutes les erreurs inattendues (base de données, serveur, etc.)
    console.log(error); // Log serveur pour le débogage
    res.status(500).json({
      message: "Erreur serveur",
      error: error.message // À désactiver en production si trop verbeux
    });
  }
};

const getAllUsers = async(req, res) => {
    try {
        const users = await User.find({}, { password: 0 })  
        console.log('Users found:', users.length);

        return res.status(200).json(users)
    } catch (error) {
        console.log(error)
        res.status(500).json({message: "Erreur serveur", error: error.message})
    }
}

const getUserById = async(req,res) => {
    try {
        const user = await User.findById(req.params.id).select('-password')  
        if(!user){
            return res.status(404).json({message: "L'utilisateur n'existe pas"})
        }
        return res.status(200).json(user)
    } catch (error) {
        console.log(error)
        res.status(500).json({message: "Erreur serveur", error: error.message})
    }
}

const updateUser = async (req, res) => {
  try {
    const { body } = req;

    if (!body) {
      return res.status(400).json({ message: "Pas de données dans la requête" });
    }

    // Validation des données avec Joi
    const { error } = userValidation(body).userUpdate;
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // Empêcher un utilisateur non autorisé de modifier son rôle
    if (body.role && req.user.role !== "ADMIN" && req.user.role !== "MODERATEUR") {
      return res
        .status(403)
        .json({ message: "Vous ne pouvez pas modifier votre rôle." });
    }

    //  Mise à jour de l'utilisateur
    const updatedUser = await User.findByIdAndUpdate(req.params.id, body, {
      new: true,
    }).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "L'utilisateur n'existe pas" });
    }

    return res.status(200).json(updatedUser);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};


const deleteUser = async(req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id)
        if(!user){
            return res.status(404).json({message: "L'utilisateur n'existe pas"})
        }
        return res.status(200).json({message: "L'utilisateur a été supprimé"})
    } catch (error) {
        console.log(error)
        res.status(500).json({message: "Erreur serveur", error: error.message})
    }
}

export { register, login, getAllUsers, getUserById, updateUser, deleteUser }




