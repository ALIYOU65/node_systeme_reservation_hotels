import joi from 'joi';

export default function chambrephotoValidation(body) {
  const singleImageSchema = joi.object({
    url: joi.string().uri().required(),
  });

  const chambrephotoCreate = joi.object({
    _id: joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
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

  const chambrephotoUpdate = joi.object({
    _id: joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    nom: joi.string().optional(),
    alt: joi.string().optional().allow('').custom((value, helpers) => {
      if (Array.isArray(value)) return value[0] || '';
      return value;
    }, 'Handle array alt'),
    images: joi.array().items(singleImageSchema).optional().min(1),
  });

  return {
    chambrephotoCreate: chambrephotoCreate.validate(body),
    chambrephotoUpdate: chambrephotoUpdate.validate(body),
  };
}