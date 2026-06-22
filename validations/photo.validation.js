import joi from 'joi';

export default function photoValidation(body) {
  const singleImageSchema = joi.object({
    url: joi.string().uri().required(),
    id: joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional().messages({
      'string.pattern.base': 'L\'ID doit être un identifiant MongoDB valide.',
    }),
  });

  const photoCreate = joi.object({
    nom: joi.string().required().messages({ 'any.required': 'Le nom du bloc photo est requis.' }),
    alt: joi.string().optional().allow('').custom((value, helpers) => {
      if (Array.isArray(value)) return value[0] || '';
      return value;
    }, 'Handle array alt'),
    images: joi.array().items(singleImageSchema).min(1).required().messages({
      'array.min': 'Au moins une image est requise.',
      'any.required': 'Les images sont requises.',
    }),
  });

  const photoUpdate = joi.object({
    nom: joi.string().optional(),
    alt: joi.string().optional().allow('').custom((value, helpers) => {
      if (Array.isArray(value)) return value[0] || '';
      return value;
    }, 'Handle array alt'),
    images: joi.array().items(singleImageSchema).optional().min(1),
  });

  return {
    photoCreate: photoCreate.validate(body),
    photoUpdate: photoUpdate.validate(body),
  };
}