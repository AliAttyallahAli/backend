import { NextResponse } from 'next/server';
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_jwt';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token d\'authentification requis' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide ou expiré' });
    }
    req.user = user;
    next();
  });
};

const requireAdminOrChef = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'chef_operation') {
    return res.status(403).json({ 
      error: 'Accès non autorisé. Droits admin ou chef d\'opération requis.' 
    });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Accès non autorisé. Droits administrateur requis.' 
    });
  }
  next();
};

const requireCaissierOrAbove = (req, res, next) => {
  const allowedRoles = ['admin', 'chef_operation', 'caissier', 'agent'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ 
      error: 'Accès non autorisé. Droits insuffisants.' 
    });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireAdminOrChef,
  requireAdmin,
  requireCaissierOrAbove
};

export function middleware(request) {
    const token = request.cookies.get('token');
    const { pathname } = request.nextUrl;

    // Routes protégées
    const protectedRoutes = ['/dashboard', '/profile', '/analytics', '/admin'];

    if (protectedRoutes.some(route => pathname.startsWith(route)){
        if (!token) {
            return NextResponse.redirect(new URL('/', request.url));
        }
    };

    // Routes admin seulement
    const adminRoutes = ['/admin', '/analytics'];
    if (adminRoutes.some(route => pathname.startsWith(route))) {
        // Vérifier le rôle de l'utilisateur
        // Cette vérification serait plus robuste avec un appel API
        const user = JSON.parse(request.cookies.get('user') || '{}');
        if (!['admin', 'chef_operation'].includes(user.role)) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/profile/:path*',
        '/analytics/:path*',
        '/admin/:path*'
    ]
};
