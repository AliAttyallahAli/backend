const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./adouas_mc.db');

db.serialize(() => {
  console.log('Initialisation de la base de données ADOUAS-MC...');
  
  // Créer les tables
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
  

  // ... (le reste des tables comme dans server.js)

  // Créer l'admin principal
  const adminPassword = bcrypt.hashSync('password', 10);
  db.run(`INSERT OR IGNORE INTO users (id, name, email, password, role) 
          VALUES (1, 'Admin Principal', 'admin@adouas-mc.com', ?, 'admin')`, [adminPassword]);
         

  console.log('Base de données initialisée avec succès!');
  console.log('Identifiants admin: admin@adouas-mc.com / admin123');
});

db.close();