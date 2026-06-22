import joi from 'joi';

export default function chambreValidation(body, isUpdate = false) {
  const objectId = joi.string().regex(/^[0-9a-fA-F]{24}$/).message('ID invalide (format ObjectId attendu).');

  const baseSchema = {
    type_chambre: joi.string().valid('Simple', 'Double', 'Suite').required().messages({ 
      'any.required': 'Le type de chambre est requis.', 
      'any.only': 'Type invalide (Simple, Double, Suite).' 
    }),
    capacite: joi.number().integer().min(1).max(50).required().messages({ 
      'any.required': 'La capacité est requise.', 
      'number.min': 'Capacité minimale : 1' 
    }),
    prix_nuit: joi.number().min(0).required().messages({ 
      'any.required': 'Le prix par nuit est requis.', 
      'number.min': 'Prix minimal : 0' 
    }),
    etat: joi.string().valid('Libre', 'Occupée').optional().default('Libre').messages({ 
      'any.only': 'État invalide (Libre, Occupée).' 
    }),
    description: joi.string().max(500).optional().messages({ 
      'string.max': 'Description trop longue (max 500 caractères).' 
    }),
    hotel: objectId.required().messages({ 
      'any.required': 'L\'ID de l\'hôtel est requis.' 
    }),

    // ✅ Champs manquants ajoutés
    reservations: joi.array().items(objectId).optional().messages({
      'array.base': 'Le champ reservations doit être un tableau d’IDs valides.'
    }),
    photos: joi.array().items(objectId).optional().messages({
      'array.base': 'Le champ photos doit être un tableau d’IDs valides.'
    }),
  };

  // Création
  const createSchema = joi.object(baseSchema);

  // Mise à jour
  const updateSchema = joi.object({
    ...baseSchema,
    type_chambre: baseSchema.type_chambre.optional(),
    capacite: baseSchema.capacite.optional(),
    prix_nuit: baseSchema.prix_nuit.optional(),
    etat: baseSchema.etat.optional(),
    description: baseSchema.description.optional(),
    hotel: baseSchema.hotel.optional(), // Ne pas changer l'hôtel en update
  });

  return {
    chambreCreate: createSchema.validate(body),
    chambreUpdate: updateSchema.validate(body),
  };
}
