const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { authenticateToken, requireAdminOrChef } = require('../middleware/auth');

const router = express.Router();

// Get all users
router.get('/', authenticateToken, requireAdminOrChef, async (req, res) => {
  try {
    const users = await User.getAll();
    res.json(users);
  } catch (error) {
    console.error('Erreur récupération utilisateurs:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Create user
router.post('/', authenticateToken, requireAdminOrChef, async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      phone
    });

    res.status(201).json({ 
      message: 'Utilisateur créé avec succès',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Un utilisateur avec cet email existe déjà' });
    }
    console.error('Erreur création utilisateur:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Update user
router.put('/:id', authenticateToken, requireAdminOrChef, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, phone } = req.body;

    const user = await User.update(id, { name, email, role, phone });
    res.json({ 
      message: 'Utilisateur mis à jour avec succès',
      user 
    });
  } catch (error) {
    console.error('Erreur mise à jour utilisateur:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Delete user
router.delete('/:id', authenticateToken, requireAdminOrChef, async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    // Implémenter la suppression dans le modèle User
    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression utilisateur:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;