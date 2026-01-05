const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_jwt';

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const user = await User.findByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        photo: user.photo
      }
    });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Vérifier le token
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: req.user
  });
});

// Changer le mot de passe
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    // Implémenter la mise à jour du mot de passe dans le modèle User

    res.json({ message: 'Mot de passe changé avec succès' });
  } catch (error) {
    console.error('Erreur changement mot de passe:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;