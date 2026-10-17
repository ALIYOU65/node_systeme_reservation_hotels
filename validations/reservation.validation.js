import joi from 'joi';

export default function reservationValidation(body, isUpdate = false) {
  const baseSchema = {
    date_debut: joi.date().iso().required().messages({ 
      'any.required': 'La date de début est requise.', 
      'date.base': 'Format de date invalide (ISO).' 
    }),
    date_fin: joi.date().iso().min(joi.ref('date_debut')).required().messages({ 
      'any.required': 'La date de fin est requise.', 
      'date.base': 'Format de date invalide (ISO).', 
      'date.min': 'La date de fin doit être après la date de début.' 
    }),
    statut: joi.string().valid('En attente', 'Confirmée', 'Annulée', 'Expirée', 'Payée').optional().default('En attente').messages({ 
      'any.only': 'Statut invalide.' 
    }),
    client: joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({ 
      'any.required': 'L\'ID du client est requis.',
      'string.pattern.base': 'L\'ID du client doit être un identifiant MongoDB valide.',
    }),
    chambre: joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({ 
      'any.required': 'L\'ID de la chambre est requis.',
      'string.pattern.base': 'L\'ID de la chambre doit être un identifiant MongoDB valide.',
    }),
    personnel: joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional().messages({ 
      'string.pattern.base': 'L\'ID du personnel doit être un identifiant MongoDB valide.',
    }),

    'paiement.amount': joi.number().min(0).optional().messages({ 'number.min': 'Montant invalide.' }),
    'paiement.status': joi.string().valid('pending', 'succeeded', 'failed').optional().messages({ 'any.only': 'Statut paiement invalide.' }),
    'paiement.paymentIntentId': joi.string().optional(),
    'paiement.invoiceUrl': joi.string().optional().uri().messages({ 'string.uri': 'URL facture invalide.' }),
  };

  const createSchema = joi.object(baseSchema);
  const updateSchema = joi.object({
    ...baseSchema,
    date_debut: baseSchema.date_debut.optional(),
    date_fin: baseSchema.date_fin.optional(),
    statut: baseSchema.statut.optional(),
    client: baseSchema.client.optional(),
    chambre: baseSchema.chambre.optional(),
    personnel: baseSchema.personnel.optional(),
  });

  return {
    reservationCreate: createSchema.validate(body),
    reservationUpdate: updateSchema.validate(body),
  };
}
























