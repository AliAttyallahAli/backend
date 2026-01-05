const db = require('../config/database');

class User {
  static async create(userData) {
    const { name, email, password, role, phone } = userData;
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (name, email, password, role, phone) 
         VALUES (?, ?, ?, ?, ?)`,
        [name, email, password, role, phone],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...userData });
        }
      );
    });
  }

  static async findByEmail(email) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async update(id, userData) {
    const { name, email, role, phone } = userData;
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET name = ?, email = ?, role = ?, phone = ? WHERE id = ?',
        [name, email, role, phone, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...userData });
        }
      );
    });
  }

  static async getAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT id, name, email, role, phone, photo, created_at FROM users', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = User;