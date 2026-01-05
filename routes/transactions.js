const express = require('express');
const Transaction = require('../models/Transaction');
const { authenticateToken, requireAdminOrChef, requireCaissierOrAbove } = require('../middleware/auth');

const router = express.Router();

// Get all transactions with filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      type: req.query.type,
      date: req.query.date
    };
    
    const transactions = await Transaction.getAll(filters);
    res.json(transactions);
  } catch (error) {
    console.error('Erreur récupération transactions:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Create new transaction
router.post('/', authenticateToken, requireCaissierOrAbove, async (req, res) => {
  try {
    const { from_wallet, to_wallet, amount, type, description, interest_rate } = req.body;
    
    if (!from_wallet || !to_wallet || !amount || !type) {
      return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Le montant doit être positif' });
    }

    const transactionData = {
      from_wallet,
      to_wallet,
      amount: parseFloat(amount),
      type,
      description,
      interest_rate: interest_rate ? parseFloat(interest_rate) : 0,
      created_by: req.user.id
    };

    const transaction = await Transaction.create(transactionData);
    
    res.status(201).json({
      message: 'Transaction créée avec succès. En attente de validation.',
      transaction
    });
  } catch (error) {
    console.error('Erreur création transaction:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Validate transaction
router.post('/:id/validate', authenticateToken, requireAdminOrChef, async (req, res) => {
  try {
    const { id } = req.params;
    
    const transaction = await Transaction.validate(id, req.user.id);
    
    res.json({
      message: 'Transaction validée et exécutée avec succès',
      transaction
    });
  } catch (error) {
    if (error.message === 'Solde insuffisant') {
      return res.status(400).json({ error: 'Solde insuffisant pour effectuer la transaction' });
    }
    if (error.message === 'Transaction non trouvée') {
      return res.status(404).json({ error: 'Transaction non trouvée' });
    }
    console.error('Erreur validation transaction:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Cancel transaction
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Implémenter l'annulation dans le modèle Transaction
    res.json({ message: 'Transaction annulée avec succès' });
  } catch (error) {
    console.error('Erreur annulation transaction:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Get transaction by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Implémenter la récupération par ID dans le modèle Transaction
    res.json({ message: 'Détails de la transaction' });
  } catch (error) {
    console.error('Erreur récupération transaction:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Search transactions
router.get('/search/:query', authenticateToken, async (req, res) => {
  try {
    const { query } = req.params;
    
    // Implémenter la recherche dans le modèle Transaction
    const transactions = await Transaction.search(query);
    res.json(transactions);
  } catch (error) {
    console.error('Erreur recherche transactions:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Get pending transactions
router.get('/status/pending', authenticateToken, async (req, res) => {
  try {
    const transactions = await Transaction.getPending();
    res.json(transactions);
  } catch (error) {
    console.error('Erreur récupération transactions en attente:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;