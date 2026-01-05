const express = require('express');
const Loan = require('../models/Loan');
const { authenticateToken, requireAdminOrChef } = require('../middleware/auth');

const router = express.Router();

// Get all loans
router.get('/', authenticateToken, async (req, res) => {
  try {
    const loans = await Loan.getAll();
    res.json(loans);
  } catch (error) {
    console.error('Erreur récupération prêts:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Create new loan
router.post('/', authenticateToken, requireAdminOrChef, async (req, res) => {
  try {
    const { client_id, amount, interest_rate, duration, purpose, collateral } = req.body;
    
    if (!client_id || !amount || !interest_rate || !duration) {
      return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Le montant doit être positif' });
    }

    if (interest_rate < 1 || interest_rate > 20) {
      return res.status(400).json({ error: 'Le taux d\'intérêt doit être entre 1% et 20%' });
    }

    const loanData = {
      client_id: parseInt(client_id),
      amount: parseFloat(amount),
      interest_rate: parseFloat(interest_rate),
      duration: parseInt(duration),
      purpose,
      collateral,
      created_by: req.user.id
    };

    const loan = await Loan.create(loanData);
    
    res.status(201).json({
      message: 'Prêt créé avec succès',
      loan
    });
  } catch (error) {
    console.error('Erreur création prêt:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Process loan repayment
router.post('/:id/repayment', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Montant de remboursement invalide' });
    }

    const loan = await Loan.repay(id, parseFloat(amount));
    
    res.json({
      message: 'Remboursement effectué avec succès',
      loan
    });
  } catch (error) {
    if (error.message === 'Prêt non trouvé') {
      return res.status(404).json({ error: 'Prêt non trouvé' });
    }
    console.error('Erreur remboursement prêt:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Get loan by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Implémenter la récupération par ID dans le modèle Loan
    res.json({ message: 'Détails du prêt' });
  } catch (error) {
    console.error('Erreur récupération prêt:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Get client loans
router.get('/client/:clientId', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;
    const loans = await Loan.getByClient(clientId);
    res.json(loans);
  } catch (error) {
    console.error('Erreur récupération prêts client:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Get active loans
router.get('/status/active', authenticateToken, async (req, res) => {
  try {
    const loans = await Loan.getActive();
    res.json(loans);
  } catch (error) {
    console.error('Erreur récupération prêts actifs:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Update loan status
router.put('/:id/status', authenticateToken, requireAdminOrChef, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Implémenter le changement de statut dans le modèle Loan
    res.json({ message: 'Statut du prêt mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur mise à jour statut prêt:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;