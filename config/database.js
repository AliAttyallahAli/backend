const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'adouas_mc.db');
const db = new sqlite3.Database(dbPath);

// Initialisation de la base de données
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

  // Table des logs d'activité
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

  // Créer l'admin principal
  const adminPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO users (id, name, email, password, role) 
          VALUES (1, 'Admin Principal', 'admin@adouas-mc.com', ?, 'admin')`, [adminPassword]);

  // Créer le wallet principal
  db.run(`INSERT OR IGNORE INTO wallets (id, user_id, address, balance, type) 
          VALUES (1, 1, 'ADOUAS_MAIN_WALLET', 1000000000, 'main')`);

  console.log('✅ Base de données initialisée avec succès');
});

module.exports = db;