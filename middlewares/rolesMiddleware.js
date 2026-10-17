export const rolesMiddleware = (authorizedRoles = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Utilisateur non authentifié." });
      }

      const userIdFromToken = req.user.id;
      const userRole = req.user.role;
      const requestedUserId = req.params.id;

      // l'utilisateur agit sur lui-même (profil personnel)
      if (requestedUserId && requestedUserId === userIdFromToken) {
        return next();
      }

      // l'utilisateur a un rôle autorisé
      if (authorizedRoles.includes(userRole)) {
        return next();
      }

      // accès refusé
      return res.status(403).json({
        message: `Accès refusé. Rôles autorisés : ${authorizedRoles.join(", ")}.`,
      });
    } catch (error) {
      console.error("Erreur rolesMiddleware :", error);
      return res.status(500).json({ message: "Erreur serveur dans rolesMiddleware." });
    }
  };
};

// Pour compatibilité (admin/modérateur)
export const adminOnly = rolesMiddleware(["ADMIN", "MODERATEUR"]);

export default rolesMiddleware;

























