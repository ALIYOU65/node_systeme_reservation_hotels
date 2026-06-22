import joi from 'joi';

export default function hotelValidation(body, isUpdate = false) {
  const schema = joi.object({
    _id: joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().messages({
      'string.pattern.base': 'L\'ID de l\'hôtel doit être un ObjectId MongoDB valide (24 caractères hexadécimaux).'
    }),
    nom: joi.string().required().messages({
      'any.required': 'Le nom est requis.'
    }),
    adresse: joi.string().required().messages({
      'any.required': 'L\'adresse est requise.'
    }),
    description: joi.string().required().messages({
      'any.required': 'La description est requise.'
    }),
    etoiles: joi.alternatives().try(joi.number().integer().min(1).max(5), joi.string().valid().when('string', { is: joi.string().regex(/^\d+$/), then: joi.string().custom((value) => Number(value)) })) .required().messages({
      'any.required': 'Le nombre d\'étoiles est requis.',
      'alternatives.types': 'Le nombre d\'étoiles doit être un entier entre 1 et 5.'
    }),
    prix: joi.alternatives().try(joi.number().min(0), joi.string().valid().when('string', { is: joi.string().regex(/^\d+(\.\d{1,2})?$/), then: joi.string().custom((value) => Number(value)) })) .required().messages({
      'any.required': 'Le prix est requis.',
      'alternatives.types': 'Le prix doit être un nombre ≥ 0.'
    }),
    personnel: joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .optional() // Optional car auto-set en controller
      .messages({
        'string.pattern.base': 'L\'ID du personnel doit être un ObjectId MongoDB valide (24 caractères hexadécimaux).'
      }),
    photos: joi.array().items(joi.string()).optional().messages({
      'array.base': 'photos doit être un array d\'IDs.',
      'any.required': 'Les photos sont optionnelles.'
    }),
    chambres: joi.array().items(joi.string()).optional().messages({
      'array.base': 'chambres doit être un array d\'IDs.'
    }),
    avis: joi.array().items(joi.string().regex(/^[0-9a-fA-F]{24}$/)).optional().messages({
      'array.base': 'avis doit être un array d\'IDs ObjectId.',
      'string.pattern.base': 'Chaque ID avis doit être un ObjectId valide.'
    }),
    // Nouveaux champs pour la validation (optionnels, gérés par défaut dans le schéma Mongoose)
    validated: joi.boolean().optional().messages({
      'boolean.base': 'validated doit être un booléen.'
    }),
    validatedBy: isUpdate
      ? joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().messages({
          'string.pattern.base': 'validatedBy doit être un ObjectId MongoDB valide (24 caractères hexadécimaux).'
        })
      : joi.forbidden(),  // Interdit en création (géré par défaut)
    validatedAt: isUpdate
      ? joi.date().optional().messages({
          'date.base': 'validatedAt doit être une date valide.'
        })
      : joi.forbidden(),  // Interdit en création (géré par défaut)
  });
  return {
    hotelCreate: schema.validate(body),
    hotelUpdate: schema.validate(body), // Même schéma pour simplicité, avec ajustements pour update
  };
}






















// import joi from 'joi';

// export default function hotelValidation(body, isUpdate = false) {
//   const schema = joi.object({
//     _id: joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().messages({
//       'string.pattern.base': 'L\'ID de l\'hôtel doit être un ObjectId MongoDB valide (24 caractères hexadécimaux).'
//     }),
//     nom: joi.string().required().messages({
//       'any.required': 'Le nom est requis.'
//     }),
//     adresse: joi.string().required().messages({
//       'any.required': 'L\'adresse est requise.'
//     }),
//     description: joi.string().required().messages({
//       'any.required': 'La description est requise.'
//     }),
//     capacite: joi.alternatives().try(joi.number().integer().min(1), joi.string().valid().when('string', { is: joi.string().regex(/^\d+$/), then: joi.string().custom((value) => Number(value)) })) .required().messages({
//       'any.required': 'La capacité est requise.',
//       'alternatives.types': 'La capacité doit être un nombre entier ≥ 1.'
//     }),
//     prix: joi.alternatives().try(joi.number().min(0), joi.string().valid().when('string', { is: joi.string().regex(/^\d+(\.\d{1,2})?$/), then: joi.string().custom((value) => Number(value)) })) .required().messages({
//       'any.required': 'Le prix est requis.',
//       'alternatives.types': 'Le prix doit être un nombre ≥ 0.'
//     }),
//     personnel: joi.string()
//       .regex(/^[0-9a-fA-F]{24}$/)
//       .optional() // Optional car auto-set en controller
//       .messages({
//         'string.pattern.base': 'L\'ID du personnel doit être un ObjectId MongoDB valide (24 caractères hexadécimaux).'
//       }),
//     photos: joi.array().items(joi.string()).optional().messages({
//       'array.base': 'photos doit être un array d\'IDs.',
//       'any.required': 'Les photos sont optionnelles.'
//     }),
//     chambres: joi.array().items(joi.string()).optional().messages({
//       'array.base': 'chambres doit être un array d\'IDs.'
//     }),
//     avis: joi.array().items(joi.string().regex(/^[0-9a-fA-F]{24}$/)).optional().messages({
//       'array.base': 'avis doit être un array d\'IDs ObjectId.',
//       'string.pattern.base': 'Chaque ID avis doit être un ObjectId valide.'
//     }),
//     // Nouveaux champs pour la validation (optionnels, gérés par défaut dans le schéma Mongoose)
//     validated: joi.boolean().optional().messages({
//       'boolean.base': 'validated doit être un booléen.'
//     }),
//     validatedBy: isUpdate 
//       ? joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().messages({
//           'string.pattern.base': 'validatedBy doit être un ObjectId MongoDB valide (24 caractères hexadécimaux).'
//         })
//       : joi.forbidden(),  // Interdit en création (géré par défaut)
//     validatedAt: isUpdate 
//       ? joi.date().optional().messages({
//           'date.base': 'validatedAt doit être une date valide.'
//         })
//       : joi.forbidden(),  // Interdit en création (géré par défaut)
//   });

//   return {
//     hotelCreate: schema.validate(body),
//     hotelUpdate: schema.validate(body), // Même schéma pour simplicité, avec ajustements pour update
//   };
// }

























