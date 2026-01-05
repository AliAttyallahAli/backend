const db = require('../config/database');

class Client {
  static async create(clientData) {
    const { name, email, phone, address, cin } = clientData;
    const wallet_address = `ADOUAS_CLIENT_${Date.now()}`;
    
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `INSERT INTO clients (name, email, phone, address, cin, wallet_address) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [name, email, phone, address, cin, wallet_address],
          function(err) {
            if (err) return reject(err);
            
            const clientId = this.lastID;
            
            // Créer le wallet du client
            db.run(
              'INSERT INTO wallets (client_id, address, balance, type) VALUES (?, ?, ?, ?)',
              [clientId, wallet_address, 5000, 'client'],
              function(err) {
                if (err) return reject(err);
                resolve({ 
                  id: clientId, 
                  ...clientData, 
                  wallet_address,
                  balance: 5000 
                });
              }
            );
          }
        );
      });
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT c.*, w.balance,
               (SELECT COUNT(*) FROM loans WHERE client_id = c.id) as total_loans,
               (SELECT SUM(remaining_amount) FROM loans WHERE client_id = c.id AND status = 'active') as active_loans_amount
        FROM clients c 
        LEFT JOIN wallets w ON c.id = w.client_id 
        WHERE c.id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getAll() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT c.*, w.balance 
        FROM clients c 
        LEFT JOIN wallets w ON c.id = w.client_id
        ORDER BY c.created_at DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getTransactions(clientId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT t.* 
        FROM transactions t 
        JOIN wallets w ON t.from_wallet = w.address OR t.to_wallet = w.address 
        WHERE w.client_id = ? 
        ORDER BY t.created_at DESC
      `, [clientId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = Client;