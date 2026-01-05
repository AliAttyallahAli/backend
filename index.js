const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const moment = require('moment');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'votre_secret_jwt';

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(express.static(path.join(__dirname, 'public')));
// Initialisation de la base de données
const db = new sqlite3.Database('./adouas_mc.db');

// Création des tables
db.serialize(() => {
  // Table des utilisateurs
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT,
    photo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Table des clients
  db.run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    address TEXT,
    photo TEXT,
    cin TEXT UNIQUE,
    wallet_address TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Table des wallets
  db.run(`CREATE TABLE IF NOT EXISTS wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    client_id INTEGER,
    address TEXT UNIQUE NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0,
    type TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(client_id) REFERENCES clients(id)
  )`);

  // Table des transactions
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_wallet TEXT NOT NULL,
    to_wallet TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    interest_rate DECIMAL(5,2) DEFAULT 0,
    description TEXT,
    validated_by INTEGER,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    validated_at DATETIME,
    FOREIGN KEY(validated_by) REFERENCES users(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
  )`);

  // Table des prêts
  db.run(`CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,2) NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    remaining_amount DECIMAL(15,2) NOT NULL,
    status TEXT DEFAULT 'active',
    start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_date DATETIME,
    created_by INTEGER,
    FOREIGN KEY(client_id) REFERENCES clients(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
  )`);

  // Initialisation de l'admin et du wallet principal
  const adminPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO users (id, name, email, password, role) 
          VALUES (1, 'Admin Principal', 'admin@adouas-mc.com', ?, 'admin')`, [adminPassword]);

  db.run(`INSERT OR IGNORE INTO wallets (id, user_id, address, balance, type) 
          VALUES (1, 1, 'ADOUAS_MAIN_WALLET', 1000000000, 'main')`);
});

// Middleware d'authentification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requis' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide' });
    }
    req.user = user;
    next();
  });
};

// Middleware pour admin/chef d'opération
const requireAdminOrChef = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'chef_operation') {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }
  next();
};

// Routes d'authentification
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
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
        photo: user.photo
      }
    });
  });
});
// Route pour les statistiques dashboard
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  // Compter les transactions en attente
  db.get('SELECT COUNT(*) as count FROM transactions WHERE status = "pending"', (err, pendingResult) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Compter les prêts actifs
    db.get('SELECT COUNT(*) as count FROM loans WHERE status = "active"', (err, loansResult) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Compter les clients totaux
      db.get('SELECT COUNT(*) as count FROM clients', (err, clientsResult) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        // Transactions d'aujourd'hui
        const today = new Date().toISOString().split('T')[0];
        db.get('SELECT COUNT(*) as count FROM transactions WHERE DATE(created_at) = ?', [today], (err, todayResult) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          const stats = {
            totalBalance: 1000000000,
            pendingTransactions: pendingResult.count,
            activeLoans: loansResult.count,
            totalClients: clientsResult.count,
            todayTransactions: todayResult.count,
            monthlyRevenue: 2500000
          };

          // S'assurer que toutes les valeurs sont des nombres
          Object.keys(stats).forEach(key => {
            if (typeof stats[key] === 'object') {
              stats[key] = 0;
            }
          });

          res.json(stats);
        });
      });
    });
  });
});
// Importer les routes documents
const documentRoutes = require('./routes/documents');
app.use('/api', documentRoutes);

// Route test pour vérifier que les documents fonctionnent
app.get('/api/test-documents', (req, res) => {
  res.json({ 
    message: 'Module documents actif',
    endpoints: [
      'GET /api/generate-card/:clientId',
      'POST /api/generate-report',
      'POST /api/generate-statement/:clientId',
      'POST /api/generate-contract/:clientId'
    ]
  });
});

// Routes utilisateurs
app.get('/api/users', authenticateToken, requireAdminOrChef, (req, res) => {
  db.all('SELECT id, name, email, role, phone, photo, created_at FROM users', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post('/api/users', authenticateToken, requireAdminOrChef, (req, res) => {
  const { name, email, password, role, phone } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
    [name, email, hashedPassword, role, phone],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Créer le wallet pour le nouvel utilisateur
      const walletAddress = `ADOUAS_${role.toUpperCase()}_${this.lastID}`;
      const initialBalance = role === 'caissier' || role === 'agent' || role === 'chef_operation' ? 5000 : 0;

      db.run(
        'INSERT INTO wallets (user_id, address, balance, type) VALUES (?, ?, ?, ?)',
        [this.lastID, walletAddress, initialBalance, 'user']
      );

      res.json({ id: this.lastID, message: 'Utilisateur créé avec succès' });
    }
  );
});
// Routes manquantes pour le backend

// Mettre à jour un utilisateur
app.put('/api/users/:id', authenticateToken, requireAdminOrChef, (req, res) => {
  const { id } = req.params;
  const { name, email, role, phone } = req.body;

  db.run(
    'UPDATE users SET name = ?, email = ?, role = ?, phone = ? WHERE id = ?',
    [name, email, role, phone, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Utilisateur mis à jour avec succès' });
    }
  );
});

// Supprimer un utilisateur
app.delete('/api/users/:id', authenticateToken, requireAdminOrChef, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Utilisateur supprimé avec succès' });
  });
});

// Remboursement de prêt
app.post('/api/loans/:id/repayment', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  db.get('SELECT * FROM loans WHERE id = ?', [id], (err, loan) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!loan) {
      return res.status(404).json({ error: 'Prêt non trouvé' });
    }

    // Récupérer le wallet du client
    db.get('SELECT wallet_address FROM clients WHERE id = ?', [loan.client_id], (err, client) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const newPaidAmount = loan.paid_amount + parseFloat(amount);
      const newRemainingAmount = loan.total_amount - newPaidAmount;
      const status = newRemainingAmount <= 0 ? 'completed' : 'active';

      // Calculer les intérêts pour cette transaction
      const interestAmount = (parseFloat(amount) * loan.interest_rate) / 100;

      db.serialize(() => {
        // Mettre à jour le prêt
        db.run(
          'UPDATE loans SET paid_amount = ?, remaining_amount = ?, status = ? WHERE id = ?',
          [newPaidAmount, newRemainingAmount, status, id]
        );

        // Créer une transaction de remboursement
        db.run(
          `INSERT INTO transactions (from_wallet, to_wallet, amount, type, description, interest_rate, status, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            client.wallet_address,
            'ADOUAS_MAIN_WALLET',
            amount,
            'remboursement',
            `Remboursement prêt #${loan.id}`,
            loan.interest_rate,
            'completed',
            req.user.id
          ]
        );

        // Ajouter les intérêts au wallet principal
        if (interestAmount > 0) {
          db.run(
            'UPDATE wallets SET balance = balance + ? WHERE address = "ADOUAS_MAIN_WALLET"',
            [interestAmount]
          );
        }

        res.json({ 
          message: 'Remboursement effectué avec succès',
          newRemainingAmount,
          status
        });
      });
    });
  });
});

// Recherche avancée des transactions
app.get('/api/transactions/search', authenticateToken, (req, res) => {
  const { query, startDate, endDate, type, status } = req.query;
  
  let sql = `
    SELECT t.*, 
           u1.name as created_by_name,
           u2.name as validated_by_name,
           c1.name as from_client_name,
           c2.name as to_client_name
    FROM transactions t
    LEFT JOIN users u1 ON t.created_by = u1.id
    LEFT JOIN users u2 ON t.validated_by = u2.id
    LEFT JOIN wallets w1 ON t.from_wallet = w1.address
    LEFT JOIN clients c1 ON w1.client_id = c1.id
    LEFT JOIN wallets w2 ON t.to_wallet = w2.address
    LEFT JOIN clients c2 ON w2.client_id = c2.id
    WHERE 1=1
  `;
  
  const params = [];

  if (query) {
    sql += ` AND (
      c1.name LIKE ? OR 
      c2.name LIKE ? OR 
      t.from_wallet LIKE ? OR 
      t.to_wallet LIKE ? OR
      t.description LIKE ?
    )`;
    const searchTerm = `%${query}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (startDate && endDate) {
    sql += ' AND DATE(t.created_at) BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  if (type) {
    sql += ' AND t.type = ?';
    params.push(type);
  }

  if (status) {
    sql += ' AND t.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY t.created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Statistiques détaillées
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  const stats = {};

  // Transactions du jour
  db.get(`
    SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total 
    FROM transactions 
    WHERE DATE(created_at) = DATE('now') AND status = 'completed'
  `, (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    stats.todayTransactions = row;

    // Transactions de la semaine
    db.get(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total 
      FROM transactions 
      WHERE created_at >= DATE('now', 'weekday 0', '-7 days') AND status = 'completed'
    `, (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      stats.weekTransactions = row;

      // Prêts actifs
      db.get(`
        SELECT COUNT(*) as count, COALESCE(SUM(remaining_amount), 0) as total 
        FROM loans WHERE status = 'active'
      `, (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.activeLoans = row;

        // Transactions en attente
        db.get('SELECT COUNT(*) as count FROM transactions WHERE status = "pending"', (err, row) => {
          if (err) return res.status(500).json({ error: err.message });
          stats.pendingTransactions = row.count;

          // Solde principal
          db.get('SELECT balance FROM wallets WHERE id = 1', (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.mainBalance = row.balance;

            // Top clients
            db.all(`
              SELECT c.name, w.balance 
              FROM clients c 
              JOIN wallets w ON c.id = w.client_id 
              ORDER BY w.balance DESC 
              LIMIT 5
            `, (err, rows) => {
              if (err) return res.status(500).json({ error: err.message });
              stats.topClients = rows;

              res.json(stats);
            });
          });
        });
      });
    });
  });
});

// Middleware pour upload de photos
const multer = require('multer');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});
const upload = multer({ storage: storage });

// Upload photo de profil
app.post('/api/upload-photo', authenticateToken, upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier uploadé' });
  }

  const photoUrl = `/uploads/${req.file.filename}`;
  const userId = req.user.id;

  db.run('UPDATE users SET photo = ? WHERE id = ?', [photoUrl, userId], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ photoUrl, message: 'Photo uploadée avec succès' });
  });
});

// Changer le mot de passe
app.post('/api/change-password', authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  db.get('SELECT password FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    
    db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Mot de passe changé avec succès' });
    });
  });
});

// Routes clients
app.get('/api/clients', authenticateToken, (req, res) => {
  db.all('SELECT * FROM clients', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post('/api/clients', authenticateToken, requireAdminOrChef, (req, res) => {
  const { name, email, phone, address, cin } = req.body;
  const walletAddress = `ADOUAS_CLIENT_${Date.now()}`;

  db.run(
    'INSERT INTO clients (name, email, phone, address, cin, wallet_address) VALUES (?, ?, ?, ?, ?, ?)',
    [name, email, phone, address, cin, walletAddress],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Créer le wallet pour le nouveau client
      db.run(
        'INSERT INTO wallets (client_id, address, balance, type) VALUES (?, ?, ?, ?)',
        [this.lastID, walletAddress, 5000, 'client']
      );

      res.json({ id: this.lastID, message: 'Client créé avec succès' });
    }
  );
});

// Routes wallets
app.get('/api/wallets/:address', authenticateToken, (req, res) => {
  const { address } = req.params;

  db.get(`
    SELECT w.*, 
           u.name as user_name, 
           c.name as client_name 
    FROM wallets w 
    LEFT JOIN users u ON w.user_id = u.id 
    LEFT JOIN clients c ON w.client_id = c.id 
    WHERE w.address = ?
  `, [address], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Wallet non trouvé' });
    }
    res.json(row);
  });
});

// Routes transactions
app.post('/api/transactions', authenticateToken, (req, res) => {
  const { from_wallet, to_wallet, amount, type, description, interest_rate = 0 } = req.body;

  // Vérifier le solde de l'expéditeur
  db.get('SELECT balance FROM wallets WHERE address = ?', [from_wallet], (err, wallet) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet expéditeur non trouvé' });
    }
    if (wallet.balance < amount) {
      return res.status(400).json({ error: 'Solde insuffisant' });
    }

    // Créer la transaction
    db.run(
      `INSERT INTO transactions (from_wallet, to_wallet, amount, type, description, interest_rate, created_by, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [from_wallet, to_wallet, amount, type, description, interest_rate, req.user.id, 'pending'],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, message: 'Transaction créée en attente de validation' });
      }
    );
  });
});

app.get('/api/transactions', authenticateToken, (req, res) => {
  const { status, type, date, client } = req.query;
  let query = `
    SELECT t.*, 
           u1.name as created_by_name,
           u2.name as validated_by_name
    FROM transactions t
    LEFT JOIN users u1 ON t.created_by = u1.id
    LEFT JOIN users u2 ON t.validated_by = u2.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }
  if (type) {
    query += ' AND t.type = ?';
    params.push(type);
  }
  if (date) {
    query += ' AND DATE(t.created_at) = ?';
    params.push(date);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post('/api/transactions/:id/validate', authenticateToken, requireAdminOrChef, (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM transactions WHERE id = ?', [id], (err, transaction) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction non trouvée' });
    }

    // Effectuer la transaction
    db.serialize(() => {
      // Déduire du wallet expéditeur
      db.run('UPDATE wallets SET balance = balance - ? WHERE address = ?', 
        [transaction.amount, transaction.from_wallet]);

      // Ajouter au wallet destinataire
      db.run('UPDATE wallets SET balance = balance + ? WHERE address = ?', 
        [transaction.amount, transaction.to_wallet]);

      // Si c'est un remboursement avec intérêt, ajouter l'intérêt au wallet admin
      if (transaction.type === 'remboursement' && transaction.interest_rate > 0) {
        const interest = (transaction.amount * transaction.interest_rate) / 100;
        db.run('UPDATE wallets SET balance = balance + ? WHERE id = 1', [interest]);
      }

      // Marquer la transaction comme validée
      db.run('UPDATE transactions SET status = "completed", validated_by = ?, validated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [req.user.id, id]);

      res.json({ message: 'Transaction validée et exécutée' });
    });
  });
});
// Routes finales pour compléter le système

// Obtenir le solde en temps réel
app.get('/api/wallet/balance/:address', authenticateToken, (req, res) => {
  const { address } = req.params;

  db.get('SELECT balance FROM wallets WHERE address = ?', [address], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Wallet non trouvé' });
    }
    res.json({ balance: row.balance });
  });
});

// Vérifier le solde avant transaction
app.post('/api/transactions/check-balance', authenticateToken, (req, res) => {
  const { from_wallet, amount } = req.body;

  db.get('SELECT balance FROM wallets WHERE address = ?', [from_wallet], (err, wallet) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet expéditeur non trouvé' });
    }

    const hasSufficientBalance = wallet.balance >= amount;
    res.json({ 
      hasSufficientBalance,
      currentBalance: wallet.balance,
      requiredAmount: amount
    });
  });
});

// Statistiques avancées pour les graphiques
app.get('/api/analytics/transactions', authenticateToken, (req, res) => {
  const { period = 'month' } = req.query; // day, week, month, year

  let dateFilter = '';
  switch (period) {
    case 'day':
      dateFilter = "AND datetime(created_at) >= datetime('now', 'start of day')";
      break;
    case 'week':
      dateFilter = "AND datetime(created_at) >= datetime('now', 'weekday 0', '-7 days')";
      break;
    case 'month':
      dateFilter = "AND datetime(created_at) >= datetime('now', 'start of month')";
      break;
    case 'year':
      dateFilter = "AND datetime(created_at) >= datetime('now', 'start of year')";
      break;
  }

  const queries = {
    transactionsByType: `
      SELECT type, COUNT(*) as count, SUM(amount) as total 
      FROM transactions 
      WHERE status = 'completed' ${dateFilter}
      GROUP BY type
    `,
    transactionsByDay: `
      SELECT DATE(created_at) as date, COUNT(*) as count, SUM(amount) as total 
      FROM transactions 
      WHERE status = 'completed' ${dateFilter}
      GROUP BY DATE(created_at)
      ORDER BY date
    `,
    topClients: `
      SELECT c.name, COUNT(t.id) as transaction_count, SUM(t.amount) as total_amount
      FROM clients c
      JOIN wallets w ON c.id = w.client_id
      JOIN transactions t ON w.address = t.from_wallet OR w.address = t.to_wallet
      WHERE t.status = 'completed' ${dateFilter}
      GROUP BY c.id
      ORDER BY total_amount DESC
      LIMIT 10
    `
  };

  const results = {};

  db.get(queries.transactionsByType, (err, types) => {
    if (err) return res.status(500).json({ error: err.message });
    results.byType = types;

    db.all(queries.transactionsByDay, (err, days) => {
      if (err) return res.status(500).json({ error: err.message });
      results.byDay = days;

      db.all(queries.topClients, (err, clients) => {
        if (err) return res.status(500).json({ error: err.message });
        results.topClients = clients;

        res.json(results);
      });
    });
  });
});

// Notification système
app.get('/api/notifications', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  let notifications = [];

  // Transactions en attente pour admin/chef
  if (userRole === 'admin' || userRole === 'chef_operation') {
    db.get('SELECT COUNT(*) as count FROM transactions WHERE status = "pending"', (err, row) => {
      if (!err && row.count > 0) {
        notifications.push({
          id: 1,
          type: 'warning',
          message: `${row.count} transactions en attente de validation`,
          link: '/dashboard?tab=transactions'
        });
      }

      // Prêts à échéance
      db.get(`
        SELECT COUNT(*) as count 
        FROM loans 
        WHERE status = 'active' AND end_date < date('now', '+7 days')
      `, (err, row) => {
        if (!err && row.count > 0) {
          notifications.push({
            id: 2,
            type: 'danger',
            message: `${row.count} prêts arrivent à échéance`,
            link: '/dashboard?tab=loans'
          });
        }

        res.json(notifications);
      });
    });
  } else {
    res.json(notifications);
  }
});

// Marquer les notifications comme lues
app.post('/api/notifications/:id/read', authenticateToken, (req, res) => {
  // Implémentation du marquage des notifications comme lues
  res.json({ message: 'Notification marquée comme lue' });
});

// Backup de la base de données
app.get('/api/admin/backup', authenticateToken, requireAdminOrChef, (req, res) => {
  const backupDir = './backups';
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  const backupFile = `${backupDir}/backup_${Date.now()}.db`;
  const currentDb = './adouas_mc.db';

  fs.copyFile(currentDb, backupFile, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors du backup' });
    }
    res.json({ 
      message: 'Backup créé avec succès',
      file: backupFile 
    });
  });
});

// Système de logs d'activité
app.get('/api/activity-logs', authenticateToken, (req, res) => {
  const { limit = 50 } = req.query;

  // Cette table doit être créée pour logger les activités
  db.all(`
    SELECT * FROM activity_logs 
    ORDER BY created_at DESC 
    LIMIT ?
  `, [limit], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Middleware pour logger les activités
function logActivity(req, res, next) {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (req.user && req.method !== 'GET') {
      const activity = {
        user_id: req.user.id,
        action: `${req.method} ${req.path}`,
        description: `Action effectuée sur ${req.path}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      };

      db.run(`
        INSERT INTO activity_logs (user_id, action, description, ip_address, user_agent) 
        VALUES (?, ?, ?, ?, ?)
      `, [activity.user_id, activity.action, activity.description, activity.ip_address, activity.user_agent]);
    }
    
    originalSend.call(this, data);
  };
  
  next();
}

// Appliquer le middleware de logging
app.use(logActivity);

// Table pour les logs d'activité
db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);

// Routes prêts
app.post('/api/loans', authenticateToken, requireAdminOrChef, (req, res) => {
  const { client_id, amount, interest_rate, duration } = req.body;
  const total_amount = amount * (1 + interest_rate / 100);
  const remaining_amount = total_amount;

  db.run(
    `INSERT INTO loans (client_id, amount, interest_rate, total_amount, remaining_amount, created_by) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [client_id, amount, interest_rate, total_amount, remaining_amount, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, message: 'Prêt créé avec succès' });
    }
  );
});

app.get('/api/loans', authenticateToken, (req, res) => {
  db.all(`
    SELECT l.*, c.name as client_name, c.wallet_address 
    FROM loans l 
    JOIN clients c ON l.client_id = c.id
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Génération de carte Visa
app.get('/api/generate-card/:clientId', authenticateToken, async (req, res) => {
  const { clientId } = req.params;

  db.get('SELECT * FROM clients WHERE id = ?', [clientId], async (err, client) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!client) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    try {
      // Générer QR Code
      const qrCodeData = JSON.stringify({
        client_id: client.id,
        wallet_address: client.wallet_address,
        name: client.name
      });

      const qrCode = await QRCode.toDataURL(qrCodeData);

      // Générer PDF de la carte
      const doc = new PDFDocument({ size: [600, 380] });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=carte_${client.name}.pdf`);

      doc.pipe(res);

      // Design de la carte Visa
      doc.rect(0, 0, 600, 380).fill('#1a237e');
      doc.rect(20, 20, 560, 340).fill('#ffffff');
      
      doc.fillColor('#1a237e').fontSize(24).text('ADOUAS-MC VISA', 40, 50);
      doc.fillColor('#666').fontSize(16).text('Micro Crédit Card', 40, 80);
      
      doc.fillColor('#000').fontSize(20).text(client.name.toUpperCase(), 40, 150);
      doc.fontSize(14).text(`Compte: ${client.wallet_address}`, 40, 180);
      
      // Numéro de carte formaté
      const cardNumber = client.wallet_address.replace(/[^0-9]/g, '').padEnd(16, '0');
      const formattedCardNumber = cardNumber.match(/.{1,4}/g).join(' ');
      doc.fontSize(18).text(formattedCardNumber, 40, 220);
      
      doc.fontSize(12).text('Valide jusqu\'au: 12/25', 40, 260);
      doc.fontSize(10).text('ADOUAS Micro Crédit - Votre partenaire de confiance', 40, 320);

      // Ajouter QR Code
      doc.image(qrCode, 400, 150, { width: 120, height: 120 });

      doc.end();
    } catch (error) {
      res.status(500).json({ error: 'Erreur lors de la génération de la carte' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Serveur backend démarré sur le port ${PORT}`);
});
// Routes supplémentaires pour le backend

// Récupérer le profil utilisateur
app.get('/api/profile', authenticateToken, (req, res) => {
  const userId = req.user.id;
  
  db.get(`
    SELECT u.*, w.address as wallet_address, w.balance 
    FROM users u 
    LEFT JOIN wallets w ON u.id = w.user_id 
    WHERE u.id = ?
  `, [userId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    res.json(row);
  });
});

// Mettre à jour le profil utilisateur
app.put('/api/profile', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { name, phone, photo } = req.body;

  db.run(
    'UPDATE users SET name = ?, phone = ?, photo = ? WHERE id = ?',
    [name, phone, photo, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Profil mis à jour avec succès' });
    }
  );
});

// Récupérer les détails d'un client
app.get('/api/clients/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get(`
    SELECT c.*, w.balance, 
           (SELECT COUNT(*) FROM loans WHERE client_id = c.id) as total_loans,
           (SELECT SUM(amount) FROM loans WHERE client_id = c.id AND status = 'active') as active_loans_amount
    FROM clients c 
    LEFT JOIN wallets w ON c.id = w.client_id 
    WHERE c.id = ?
  `, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }
    res.json(row);
  });
});

// Récupérer l'historique des transactions d'un client
app.get('/api/clients/:id/transactions', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.all(`
    SELECT t.* 
    FROM transactions t 
    JOIN wallets w ON t.from_wallet = w.address OR t.to_wallet = w.address 
    WHERE w.client_id = ? 
    ORDER BY t.created_at DESC
  `, [id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Récupérer les prêts d'un client
app.get('/api/clients/:id/loans', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.all(`
    SELECT * FROM loans 
    WHERE client_id = ? 
    ORDER BY created_at DESC
  `, [id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Générer rapport PDF des transactions
app.get('/api/transactions/report/pdf', authenticateToken, async (req, res) => {
  const { startDate, endDate, clientId, type } = req.query;

  let query = `
    SELECT t.*, 
           u1.name as created_by_name,
           u2.name as validated_by_name,
           c1.name as from_client_name,
           c2.name as to_client_name
    FROM transactions t
    LEFT JOIN users u1 ON t.created_by = u1.id
    LEFT JOIN users u2 ON t.validated_by = u2.id
    LEFT JOIN wallets w1 ON t.from_wallet = w1.address
    LEFT JOIN clients c1 ON w1.client_id = c1.id
    LEFT JOIN wallets w2 ON t.to_wallet = w2.address
    LEFT JOIN clients c2 ON w2.client_id = c2.id
    WHERE 1=1
  `;
  const params = [];

  if (startDate && endDate) {
    query += ' AND DATE(t.created_at) BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }
  if (clientId) {
    query += ' AND (c1.id = ? OR c2.id = ?)';
    params.push(clientId, clientId);
  }
  if (type) {
    query += ' AND t.type = ?';
    params.push(type);
  }

  query += ' ORDER BY t.created_at DESC';

  db.all(query, params, async (err, transactions) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    try {
      const doc = new PDFDocument();
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=rapport_transactions_adouas_mc.pdf');

      doc.pipe(res);

      // En-tête du rapport
      doc.fontSize(20).text('ADOUAS-MC', 50, 50);
      doc.fontSize(16).text('Rapport des Transactions', 50, 80);
      doc.fontSize(12).text(`Généré le: ${new Date().toLocaleDateString()}`, 50, 110);
      
      // Informations de filtrage
      let yPosition = 140;
      if (startDate && endDate) {
        doc.text(`Période: ${startDate} à ${endDate}`, 50, yPosition);
        yPosition += 20;
      }
      if (type) {
        doc.text(`Type: ${type}`, 50, yPosition);
        yPosition += 20;
      }

      // Tableau des transactions
      const tableTop = yPosition + 30;
      let currentY = tableTop;

      // En-tête du tableau
      doc.fontSize(10);
      doc.text('Date', 50, currentY);
      doc.text('De', 120, currentY);
      doc.text('Vers', 200, currentY);
      doc.text('Montant', 280, currentY);
      doc.text('Type', 350, currentY);
      doc.text('Statut', 420, currentY);
      
      currentY += 20;
      doc.moveTo(50, currentY).lineTo(500, currentY).stroke();

      // Données du tableau
      transactions.forEach((transaction, index) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }

        currentY += 15;
        doc.text(new Date(transaction.created_at).toLocaleDateString(), 50, currentY);
        doc.text(transaction.from_client_name || transaction.from_wallet, 120, currentY);
        doc.text(transaction.to_client_name || transaction.to_wallet, 200, currentY);
        doc.text(`${transaction.amount} XOF`, 280, currentY);
        doc.text(transaction.type, 350, currentY);
        doc.text(transaction.status, 420, currentY);
        
        currentY += 10;
      });

      // Pied de page
      const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
      doc.text(`Total des transactions: ${totalAmount} XOF`, 50, currentY + 30);
      doc.text(`Nombre de transactions: ${transactions.length}`, 50, currentY + 50);

      doc.end();
    } catch (error) {
      res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
    }
  });
});
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  const stats = {
    totalBalance: 1000000000,
    pendingTransactions: 12,
    activeLoans: 45,
    totalClients: 128,
    todayTransactions: 8,
    monthlyRevenue: 2500000
  };
  res.json(stats);
});

// Route pour les wallets utilisateur
app.get('/api/user/wallets', authenticateToken, (req, res) => {
  db.all(`
    SELECT w.* 
    FROM wallets w 
    WHERE w.user_id = ? OR w.type = 'main'
  `, [req.user.id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Statistiques pour le dashboard
app.get('/api/stats', authenticateToken, (req, res) => {
  const stats = {};

  // Compter les transactions par statut
  db.get('SELECT COUNT(*) as pending FROM transactions WHERE status = "pending"', (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    stats.pendingTransactions = row.pending;

    db.get('SELECT COUNT(*) as total FROM transactions', (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      stats.totalTransactions = row.total;

      db.get('SELECT COUNT(*) as total FROM clients', (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.totalClients = row.total;

        db.get('SELECT COUNT(*) as active FROM loans WHERE status = "active"', (err, row) => {
          if (err) return res.status(500).json({ error: err.message });
          stats.activeLoans = row.active;

          db.get('SELECT balance FROM wallets WHERE id = 1', (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.mainBalance = row.balance;

            res.json(stats);
          });
        });
      });
    });
  });
});