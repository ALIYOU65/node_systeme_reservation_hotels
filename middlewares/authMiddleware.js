import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Accès refusé. Jeton non fourni.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: 'Token invalide.' });
    }

    // ⚡ On expose l'id et le rôle dans req.user
    req.user = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email
    };

    next();
  } catch (error) {
    console.error('Erreur middleware auth:', error);
    res.status(401).json({ message: 'Token invalide.' });
  }
};

export default authMiddleware;



















