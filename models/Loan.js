const db = require('../config/database');

class Loan {
  static async create(loanData) {
    const { client_id, amount, interest_rate, duration, created_by } = loanData;
    const total_amount = amount * (1 + interest_rate / 100);
    const remaining_amount = total_amount;

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO loans (client_id, amount, interest_rate, total_amount, remaining_amount, created_by) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [client_id, amount, interest_rate, total_amount, remaining_amount, created_by],
        function(err) {
          if (err) reject(err);
          else resolve({ 
            id: this.lastID, 
            ...loanData, 
            total_amount, 
            remaining_amount,
            status: 'active'
          });
        }
      );
    });
  }

  static async repay(loanId, amount) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.get('SELECT * FROM loans WHERE id = ?', [loanId], (err, loan) => {
          if (err) return reject(err);
          if (!loan) return reject(new Error('Prêt non trouvé'));

          const newPaidAmount = parseFloat(loan.paid_amount) + parseFloat(amount);
          const newRemainingAmount = parseFloat(loan.total_amount) - newPaidAmount;
          const status = newRemainingAmount <= 0 ? 'completed' : 'active';

          db.run(
            'UPDATE loans SET paid_amount = ?, remaining_amount = ?, status = ? WHERE id = ?',
            [newPaidAmount, newRemainingAmount, status, loanId],
            function(err) {
              if (err) reject(err);
              else resolve({
                ...loan,
                paid_amount: newPaidAmount,
                remaining_amount: newRemainingAmount,
                status
              });
            }
          );
        });
      });
    });
  }

  static async getAll() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT l.*, c.name as client_name, c.wallet_address 
        FROM loans l 
        JOIN clients c ON l.client_id = c.id
        ORDER BY l.created_at DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getByClient(clientId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM loans 
        WHERE client_id = ? 
        ORDER BY created_at DESC
      `, [clientId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getActive() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT l.*, c.name as client_name 
        FROM loans l 
        JOIN clients c ON l.client_id = c.id
        WHERE l.status = 'active'
        ORDER BY l.remaining_amount DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = Loan;