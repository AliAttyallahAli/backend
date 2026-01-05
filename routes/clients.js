const express = require('express');
const multer = require('multer');
const path = require('path');
const Client = require('../models/Client');
const { authenticateToken, requireAdminOrChef } = require('../middleware/auth');

const router = express.Router();

// Configuration de multer pour l'upload de photos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/clients/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'client-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'));
    }
  }
});

// Get all clients
router.get('/', authenticateToken, async (req, res) => {
  try {
    const clients = await Client.getAll();
    res.json(clients);
  } catch (error) {
    console.error('Erreur récupération clients:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Get client by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findById(id);
    
    if (!client) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }
    
    res.json(client);
  } catch (error) {
    console.error('Erreur récupération client:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Create new client
router.post('/', authenticateToken, requireAdminOrChef, upload.single('photo'), async (req, res) => {
  try {
    const { name, email, phone, address, cin, profession, date_of_birth, city } = req.body;
    
    if (!name || !email || !phone || !cin) {
      return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis' });
    }

    const clientData = {
      name,
      email,
      phone,
      address,
      cin,
      profession,
      date_of_birth,
      city,
      created_by: req.user.id
    };

    if (req.file) {
      clientData.photo = `/uploads/clients/${req.file.filename}`;
    }

    const client = await Client.create(clientData);
    
    res.status(201).json({
      message: 'Client créé avec succès',
      client
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      if (error.message.includes('email')) {
        return res.status(400).json({ error: 'Un client avec cet email existe déjà' });
      } else if (error.message.includes('cin')) {
        return res.status(400).json({ error: 'Un client avec ce CIN existe déjà' });
      }
    }
    console.error('Erreur création client:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Update client
router.put('/:id', authenticateToken, requireAdminOrChef, upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, profession, date_of_birth, city } = req.body;

    const updateData = {
      name,
      email,
      phone,
      address,
      profession,
      date_of_birth,
      city
    };

    if (req.file) {
      updateData.photo = `/uploads/clients/${req.file.filename}`;
    }

    // Implémenter la mise à jour dans le modèle Client
    res.json({ message: 'Client mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur mise à jour client:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Get client transactions
// Ajoutez ces routes au fichier routes/clients.js existant

// Get client transactions
router.get('/:id/transactions', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const transactions = await new Promise((resolve, reject) => {
      db.all(`
        SELECT t.* 
        FROM transactions t 
        JOIN wallets w ON t.from_wallet = w.address OR t.to_wallet = w.address 
        WHERE w.client_id = ? 
        ORDER BY t.created_at DESC
      `, [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json(transactions);
  } catch (error) {
    console.error('Erreur récupération transactions client:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Get client loans
router.get('/:id/loans', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const loans = await new Promise((resolve, reject) => {
      db.all(`
        SELECT l.* 
        FROM loans l 
        WHERE l.client_id = ? 
        ORDER BY l.created_at DESC
      `, [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json(loans);
  } catch (error) {
    console.error('Erreur récupération prêts client:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Search clients
router.get('/search/:query', authenticateToken, async (req, res) => {
  try {
    const { query } = req.params;
    
    // Implémenter la recherche dans le modèle Client
    const clients = await Client.search(query);
    res.json(clients);
  } catch (error) {
    console.error('Erreur recherche clients:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;