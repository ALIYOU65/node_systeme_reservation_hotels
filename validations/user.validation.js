import joi from "joi";

export default function userValidation(body) {
  const passwordRule = joi
    .string()
    .pattern(
      new RegExp(
        // Explication :
        // ^                         => début de la chaîne
        // (?=.*[a-z])               => au moins une minuscule
        // (?=.*[A-Z])               => au moins une majuscule
        // (?=.*\d)                  => au moins un chiffre
        // (?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]) => au moins un caractère spécial
        // [A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~éèê]{10,} => permet é, è, ê et impose min 10 caractères
        // $                         => fin de la chaîne
        '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=[\\]{};:\'",.<>/?`~])[A-Za-z\\d!@#$%^&*()_+\\-=[\\]{};:\'",.<>/?`~éèê]{10,}$'
      )
    )
    .message(
      "Le mot de passe doit contenir au moins 10 caractères, une majuscule, une minuscule, un chiffre, un caractère spécial, et peut inclure é, è, ê."
    )
    .required();

  // ← NOUVEAU : Règle pour password optionnel (sans .required())
  const optionalPasswordRule = joi
    .string()
    .pattern(
      new RegExp(
        '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=[\\]{};:\'",.<>/?`~])[A-Za-z\\d!@#$%^&*()_+\\-=[\\]{};:\'",.<>/?`~éèê]{10,}$'
      )
    )
    .message(
      "Le mot de passe doit contenir au moins 10 caractères, une majuscule, une minuscule, un chiffre, un caractère spécial, et peut inclure é, è, ê."
    )
    .allow('')  // Permet vide/undefined pour optional
    .optional();

  const userCreate = joi.object({
    email: joi.string().email().required(),
    password: passwordRule,
    prenom: joi.string().required(),
    nom: joi.string().required(),
    role: joi.string().valid("CLIENT", "MODERATEUR", "PERSONNEL"),
    dateInscription: joi.date(),
  });

  const userUpdate = joi.object({
    email: joi.string().email().optional(),
    password: optionalPasswordRule,  // ← FIX : Utilise la version optionnelle
    prenom: joi.string().optional(),
    nom: joi.string().optional(),
    role: joi.string().valid("CLIENT", "MODERATEUR", "PERSONNEL").optional(),
  });

  const userLogin = joi.object({
    email: joi.string().email().required(),
    password: joi.string().required(),
  });

  return {
    userCreate: userCreate.validate(body),
    userUpdate: userUpdate.validate(body),
    userLogin: userLogin.validate(body),
  };
}





























// import joi from "joi";

// export default function userValidation(body) {

//   const passwordRule = joi
//     .string()
//     .pattern(
//       new RegExp(
//         // Explication :
//         // ^                         => début de la chaîne
//         // (?=.*[a-z])               => au moins une minuscule
//         // (?=.*[A-Z])               => au moins une majuscule
//         // (?=.*\d)                  => au moins un chiffre
//         // (?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]) => au moins un caractère spécial
//         // [A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~éèê]{10,} => permet é, è, ê et impose min 10 caractères
//         // $                         => fin de la chaîne
//         '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=[\\]{};:\'",.<>/?`~])[A-Za-z\\d!@#$%^&*()_+\\-=[\\]{};:\'",.<>/?`~éèê]{10,}$'
//       )
//     )
//     .message(
//       "Le mot de passe doit contenir au moins 10 caractères, une majuscule, une minuscule, un chiffre, un caractère spécial, et peut inclure é, è, ê."
//     )
//     .required();

//   const userCreate = joi.object({
//     email: joi.string().email().required(),
//     password: passwordRule,
//     prenom: joi.string().required(),
//     nom: joi.string().required(),
//     role: joi.string().valid("CLIENT", "MODERATEUR", "PERSONNEL"),
//     dateInscription: joi.date(),
//   });

//   const userUpdate = joi.object({
//     email: joi.string().email(),
//     password: passwordRule,
//     prenom: joi.string(),
//     nom: joi.string(),
//     role: joi.string().valid("CLIENT", "MODERATEUR", "PERSONNEL"),
//   });

//   const userLogin = joi.object({
//     email: joi.string().email().required(),
//     password: joi.string().required(),
//   });

//   return {
//     userCreate: userCreate.validate(body),
//     userUpdate: userUpdate.validate(body),
//     userLogin: userLogin.validate(body),
//   };
// }
