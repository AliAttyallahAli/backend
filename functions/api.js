const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Route test
app.get('/', (req, res) => {
  res.json({ 
    message: 'API fonctionne!',
    timestamp: new Date().toISOString()
  });
});

// Route utilisateurs
app.get('/users', (req, res) => {
  res.json({ 
    users: [
      { id: 1, name: 'John Doe' },
      { id: 2, name: 'Jane Smith' }
    ] 
  });
});

// Route avec paramètres
app.get('/users/:id', (req, res) => {
  res.json({ 
    user: { 
      id: req.params.id, 
      name: 'Utilisateur ' + req.params.id 
    } 
  });
});

// Route POST
app.post('/users', (req, res) => {
  const newUser = req.body;
  res.json({ 
    message: 'Utilisateur créé',
    user: { id: Date.now(), ...newUser }
  });
});

// Gestion des erreurs
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Export pour Netlify Functions
module.exports.handler = serverless(app);