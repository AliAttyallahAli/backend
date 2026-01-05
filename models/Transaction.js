const db = require('../config/database');

class Transaction {
  static async create(transactionData) {
    const { from_wallet, to_wallet, amount, type, description, interest_rate, created_by } = transactionData;
    
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO transactions (from_wallet, to_wallet, amount, type, description, interest_rate, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [from_wallet, to_wallet, amount, type, description, interest_rate, created_by],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...transactionData, status: 'pending' });
        }
      );
    });
  }

  static async validate(transactionId, validatedBy) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Récupérer la transaction
        db.get('SELECT * FROM transactions WHERE id = ?', [transactionId], (err, transaction) => {
          if (err) return reject(err);
          if (!transaction) return reject(new Error('Transaction non trouvée'));

          // Vérifier le solde
          db.get('SELECT balance FROM wallets WHERE address = ?', [transaction.from_wallet], (err, wallet) => {
            if (err) return reject(err);
            if (wallet.balance < transaction.amount) {
              return reject(new Error('Solde insuffisant'));
            }

            // Effectuer les transferts
            db.run('UPDATE wallets SET balance = balance - ? WHERE address = ?', 
              [transaction.amount, transaction.from_wallet]);
            
            db.run('UPDATE wallets SET balance = balance + ? WHERE address = ?', 
              [transaction.amount, transaction.to_wallet]);

            // Gérer les intérêts pour les remboursements
            if (transaction.type === 'remboursement' && transaction.interest_rate > 0) {
              const interest = (transaction.amount * transaction.interest_rate) / 100;
              db.run('UPDATE wallets SET balance = balance + ? WHERE id = 1', [interest]);
            }

            // Marquer comme complétée
            db.run(
              'UPDATE transactions SET status = "completed", validated_by = ?, validated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [validatedBy, transactionId],
              function(err) {
                if (err) reject(err);
                else resolve({ ...transaction, status: 'completed', validated_by: validatedBy });
              }
            );
          });
        });
      });
    });
  }

  static async getAll(filters = {}) {
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

    if (filters.status) {
      query += ' AND t.status = ?';
      params.push(filters.status);
    }
    if (filters.type) {
      query += ' AND t.type = ?';
      params.push(filters.type);
    }
    if (filters.date) {
      query += ' AND DATE(t.created_at) = ?';
      params.push(filters.date);
    }

    query += ' ORDER BY t.created_at DESC';

    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getPending() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM transactions WHERE status = "pending" ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = Transaction;