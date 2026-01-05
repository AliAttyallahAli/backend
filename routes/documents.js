const express = require('express');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const moment = require('moment');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./adouas_mc.db');

// Générer carte Visa
router.get('/generate-card/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    console.log('Génération carte Visa pour client:', clientId);

    db.get('SELECT * FROM clients WHERE id = ?', [clientId], async (err, client) => {
      if (err) {
        console.error('Erreur DB client:', err);
        return res.status(500).json({ error: 'Erreur base de données' });
      }
      
      if (!client) {
        return res.status(404).json({ error: 'Client non trouvé' });
      }

      // Récupérer le solde du wallet
      db.get('SELECT balance FROM wallets WHERE client_id = ?', [clientId], async (err, wallet) => {
        if (err) {
          console.error('Erreur DB wallet:', err);
          return res.status(500).json({ error: 'Erreur base de données' });
        }

        const doc = new PDFDocument({
          layout: 'landscape',
          size: [1200, 900],
          margins: { top: 0, bottom: 0, left: 0, right: 0 }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="carte_visa_${client.name}.pdf"`);

        doc.pipe(res);

        try {
          // Générer QR Code
          const qrData = JSON.stringify({
            clientId: client.id,
            wallet: client.wallet_address,
            name: client.name,
            agency: 'ADOUAS-MC'
          });
          
          const qrCodeUrl = await QRCode.toDataURL(qrData);

          // Arrière-plan dégradé
          const gradient = doc.linearGradient(0, 0, 600, 380);
          gradient.stop(0, '#1a237e');
          gradient.stop(1, '#4a148c');
          doc.rect(0, 0, 600, 380).fill(gradient);

          // Zone blanche centrale
          doc.rect(20, 20, 560, 340)
             .fill('#ffffff')
             .stroke('#e0e0e0');

          // Logo et en-tête
          doc.fillColor('#1a237e')
             .fontSize(24)
             .font('Helvetica-Bold')
             .text('ADOUAS-MC VISA', 40, 40);

          doc.fillColor('#666')
             .fontSize(14)
             .font('Helvetica')
             .text('Micro Crédit Card', 40, 70);

          // Nom du client
          doc.fillColor('#000')
             .fontSize(20)
             .font('Helvetica-Bold')
             .text(client.name.toUpperCase(), 40, 130);

          // Numéro de compte
          doc.fillColor('#666')
             .fontSize(12)
             .text('Numéro de Compte:', 40, 170);

          doc.fillColor('#000')
             .fontSize(14)
             .font('Helvetica-Bold')
             .text(client.wallet_address, 40, 190);

          // Numéro de carte formaté
          const cardNumber = client.wallet_address.replace(/[^0-9]/g, '').padEnd(16, '0');
          const formattedCardNumber = cardNumber.match(/.{1,4}/g).join('  ');
          
          doc.fillColor('#000')
             .fontSize(18)
             .font('Helvetica-Bold')
             .text(formattedCardNumber, 40, 230);

          // Dates
          doc.fillColor('#666')
             .fontSize(10)
             .text('Valide jusqu\'au', 40, 270);

          doc.fillColor('#000')
             .fontSize(12)
             .font('Helvetica-Bold')
             .text('12/25', 40, 285);

          doc.fillColor('#666')
             .fontSize(10)
             .text('Depuis', 120, 270);

          const createdDate = new Date(client.created_at);
          doc.fillColor('#000')
             .fontSize(12)
             .font('Helvetica-Bold')
             .text(`${createdDate.getMonth() + 1}/${createdDate.getFullYear()}`, 120, 285);

          /*Solde
          doc.fillColor('#666')
             .fontSize(10)
             .text('Solde Actuel', 40, 310);

          doc.fillColor('#2e7d32')
             .fontSize(14)
             .font('Helvetica-Bold')
             .text(`${parseFloat(wallet?.balance || 0).toLocaleString('fr-FR')} XOF`, 40, 325);
            */
          // QR Code
          doc.fillColor('#1a237e')
             .fontSize(10)
             .text('QR Code', 450, 270);

          // Ajouter l'image QR Code
          doc.image(qrCodeUrl, 450, 150, { 
            width: 100, 
            height: 100,
            align: 'center'
          });

          // Pied de page
          doc.fillColor('#666')
             .fontSize(8)
             .text('ADOUAS Micro Crédit - Votre partenaire de confiance', 40, 350)
             .text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 40, 360);

          doc.end();
        } catch (error) {
          console.error('Erreur génération PDF:', error);
          res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
        }
      });
    });
  } catch (error) {
    console.error('Erreur génération carte:', error);
    res.status(500).json({ error: 'Erreur lors de la génération de la carte' });
  }
});

// Générer rapport
router.post('/generate-report', async (req, res) => {
  try {
    const { type, startDate, endDate } = req.body;
    
    console.log('Génération rapport:', { type, startDate, endDate });

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="rapport_${type}_${startDate}_${endDate}.pdf"`);

    doc.pipe(res);

    // En-tête
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text('ADOUAS-MC', 50, 50)
       .fontSize(16)
       .text(getReportTitle(type), 50, 80)
       .fontSize(12)
       .font('Helvetica')
       .text(`Période: ${new Date(startDate).toLocaleDateString('fr-FR')} - ${new Date(endDate).toLocaleDateString('fr-FR')}`, 50, 110)
       .text(`Date de génération: ${new Date().toLocaleDateString('fr-FR')}`, 50, 125);

    let yPosition = 160;

    // Contenu selon le type
    switch (type) {
      case 'transactions':
        await generateTransactionReport(doc, startDate, endDate, yPosition);
        break;
      case 'loans':
        await generateLoanReport(doc, startDate, endDate, yPosition);
        break;
      case 'clients':
        await generateClientReport(doc, yPosition);
        break;
      case 'financial':
        await generateFinancialReport(doc, startDate, endDate, yPosition);
        break;
      default:
        doc.fontSize(14).text('Type de rapport non reconnu', 50, yPosition);
    }

    // Pied de page
    doc.fontSize(8)
       .text('Document généré automatiquement par ADOUAS-MC - Système de Micro Crédit', 50, 750);

    doc.end();
  } catch (error) {
    console.error('Erreur génération rapport:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du rapport' });
  }
});

// Générer relevé client
router.post('/generate-statement/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.body;

    console.log('Génération relevé client:', { clientId, startDate, endDate });

    db.get('SELECT * FROM clients WHERE id = ?', [clientId], async (err, client) => {
      if (err) {
        console.error('Erreur DB:', err);
        return res.status(500).json({ error: 'Erreur base de données' });
      }
      
      if (!client) {
        return res.status(404).json({ error: 'Client non trouvé' });
      }

      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="releve_${client.name}.pdf"`);

      doc.pipe(res);

      // En-tête
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .text('ADOUAS-MC', 50, 50)
         .fontSize(16)
         .text('RELEVÉ DE COMPTE', 50, 80)
         .fontSize(12)
         .text('Micro Crédit - Relevé Officiel', 50, 105);

      // Informations client
      const infoY = 140;
      doc.fontSize(10)
         .text('INFORMATIONS CLIENT', 50, infoY)
         .fontSize(9)
         .text(`Nom: ${client.name}`, 50, infoY + 15)
         .text(`Email: ${client.email}`, 50, infoY + 30)
         .text(`Téléphone: ${client.phone}`, 50, infoY + 45)
         .text(`Adresse: ${client.address || 'Non renseignée'}`, 50, infoY + 60)
         .text(`Numéro de compte: ${client.wallet_address}`, 50, infoY + 75);

      // Période et solde
      const periodY = infoY + 100;
      doc.fontSize(10)
         .text('INFORMATIONS COMPTE', 300, infoY)
         .fontSize(9)
         .text(`Période: ${startDate ? new Date(startDate).toLocaleDateString('fr-FR') : 'Début'} - ${endDate ? new Date(endDate).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}`, 300, infoY + 15)
         .text(`Date d'émission: ${new Date().toLocaleDateString('fr-FR')}`, 300, infoY + 30);

      // Récupérer le solde
      db.get('SELECT balance FROM wallets WHERE client_id = ?', [clientId], (err, wallet) => {
        const balance = wallet?.balance || 0;
        
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text(`SOLDE ACTUEL: ${parseFloat(balance).toLocaleString('fr-FR')} XOF`, 300, infoY + 50);

        let yPosition = periodY + 40;

        // En-tête du tableau des transactions
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .text('DATE', 50, yPosition)
           .text('TYPE', 120, yPosition)
           .text('DESCRIPTION', 180, yPosition)
           .text('MONTANT', 400, yPosition)
           .text('STATUT', 480, yPosition);

        yPosition += 20;
        doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();

        // Récupérer les transactions
        const query = `
          SELECT * FROM transactions 
          WHERE (from_wallet = ? OR to_wallet = ?) 
          AND created_at BETWEEN ? AND ?
          ORDER BY created_at DESC
          LIMIT 50
        `;

        const start = startDate || '2000-01-01';
        const end = endDate || new Date().toISOString();

        db.all(query, [client.wallet_address, client.wallet_address, start, end], (err, transactions) => {
          if (err) {
            console.error('Erreur transactions:', err);
            doc.fontSize(10).text('Erreur lors de la récupération des transactions', 50, yPosition);
            doc.end();
            return;
          }

          transactions.forEach((transaction, index) => {
            if (yPosition > 650) {
              doc.addPage();
              yPosition = 50;
            }

            const isCredit = transaction.to_wallet === client.wallet_address;
            const amount = parseFloat(transaction.amount);
            const date = new Date(transaction.created_at).toLocaleDateString('fr-FR');
            
            doc.fontSize(8)
               .font('Helvetica')
               .text(date, 50, yPosition)
               .text(transaction.type.toUpperCase(), 120, yPosition)
               .text(transaction.description || '-', 180, yPosition, { width: 200 })
               .text(`${isCredit ? '+' : '-'}${amount.toLocaleString('fr-FR')} XOF`, 400, yPosition)
               .text(transaction.status.toUpperCase(), 480, yPosition);

            yPosition += 15;
          });

          if (transactions.length === 0) {
            doc.fontSize(9).text('Aucune transaction sur cette période', 50, yPosition);
          }

          // Signature
          const signatureY = Math.max(yPosition + 40, 700);
          doc.fontSize(8)
             .text('_________________________', 400, signatureY)
             .text('Signature et Cachet ADOUAS-MC', 400, signatureY + 10)
             .text('Pour toute question: +221 XX XXX XX XX', 50, signatureY + 30);

          doc.end();
        });
      });
    });
  } catch (error) {
    console.error('Erreur génération relevé:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du relevé' });
  }
});

// Générer contrat
router.post('/generate-contract/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { type } = req.body;

    console.log('Génération contrat:', { clientId, type });

    db.get('SELECT * FROM clients WHERE id = ?', [clientId], async (err, client) => {
      if (err) {
        console.error('Erreur DB:', err);
        return res.status(500).json({ error: 'Erreur base de données' });
      }
      
      if (!client) {
        return res.status(404).json({ error: 'Client non trouvé' });
      }

      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="contrat_${type}_${client.name}.pdf"`);

      doc.pipe(res);

      // En-tête
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text('ADOUAS-MC', 50, 50)
         .fontSize(14)
         .text(getContractTitle(type), 50, 80)
         .fontSize(10)
         .text('Micro Crédit - Contrat Officiel', 50, 100);

      let yPosition = 140;

      // Informations des parties
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('ENTRE LES SOUSSIGNÉS:', 50, yPosition);

      yPosition += 25;
      
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('ADOUAS-MC', 50, yPosition)
         .font('Helvetica')
         .text('Agence de Micro Crédit', 50, yPosition + 12)
         .text('Siège social: [Adresse de l\'agence]', 50, yPosition + 24)
         .text('Téléphone: +221 XX XXX XX XX', 50, yPosition + 36)
         .text('Email: contact@adouas-mc.com', 50, yPosition + 48);

      yPosition += 80;

      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('ET', 50, yPosition);

      yPosition += 20;

      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text(client.name.toUpperCase(), 50, yPosition)
         .font('Helvetica')
         .text(`Client - ${client.wallet_address}`, 50, yPosition + 12)
         .text(`Email: ${client.email}`, 50, yPosition + 24)
         .text(`Téléphone: ${client.phone}`, 50, yPosition + 36)
         .text(`Adresse: ${client.address || 'Non renseignée'}`, 50, yPosition + 48)
         .text(`CIN: ${client.cin}`, 50, yPosition + 60);

      yPosition += 100;

      // Contenu du contrat selon le type
      switch (type) {
        case 'pret':
          generateLoanContract(doc, client, yPosition);
          break;
        case 'renouvellement':
          generateRenewalContract(doc, client, yPosition);
          break;
        case 'echeancier':
          generatePaymentSchedule(doc, client, yPosition);
          break;
        default:
          doc.fontSize(12).text('Type de contrat non reconnu', 50, yPosition);
      }

      // Signature
      const signatureY = 650;
      doc.fontSize(9)
         .text('Fait à [Ville], le ' + new Date().toLocaleDateString('fr-FR'), 50, signatureY)
         .text('En double exemplaire', 50, signatureY + 40);

      // Signature ADOUAS-MC
      doc.text('Pour ADOUAS-MC', 300, signatureY)
         .text('_________________________', 300, signatureY + 20)
         .text('Le Directeur', 300, signatureY + 35);

      // Signature client
      doc.text('Le Client', 450, signatureY)
         .text('_________________________', 450, signatureY + 20)
         .text(client.name, 450, signatureY + 35);

      doc.end();
    });
  } catch (error) {
    console.error('Erreur génération contrat:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du contrat' });
  }
});

// Fonctions helper
function getReportTitle(type) {
  const titles = {
    transactions: 'RAPPORT DES TRANSACTIONS',
    loans: 'RAPPORT DES PRÊTS',
    clients: 'RAPPORT DES CLIENTS',
    financial: 'RAPPORT FINANCIER'
  };
  return titles[type] || 'RAPPORT';
}

function getContractTitle(type) {
  const titles = {
    pret: 'CONTRAT DE PRÊT',
    renouvellement: 'AVENANT DE RENOUVELLEMENT',
    echeancier: 'ÉCHÉANCIER DE PAIEMENT'
  };
  return titles[type] || 'CONTRAT';
}

async function generateTransactionReport(doc, startDate, endDate, yPosition) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT t.*, u.name as created_by_name 
      FROM transactions t 
      LEFT JOIN users u ON t.created_by = u.id 
      WHERE t.created_at BETWEEN ? AND ?
      ORDER BY t.created_at DESC
    `;

    db.all(query, [startDate, endDate], (err, transactions) => {
      if (err) {
        doc.fontSize(12).text('Erreur lors de la récupération des transactions', 50, yPosition);
        resolve();
        return;
      }

      // Statistiques
      const totalTransactions = transactions.length;
      const totalAmount = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const pendingCount = transactions.filter(t => t.status === 'pending').length;

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('STATISTIQUES:', 50, yPosition)
         .font('Helvetica')
         .text(`Total des transactions: ${totalTransactions}`, 50, yPosition + 15)
         .text(`Montant total: ${totalAmount.toLocaleString('fr-FR')} XOF`, 50, yPosition + 30)
         .text(`Transactions en attente: ${pendingCount}`, 50, yPosition + 45);

      yPosition += 70;

      // Tableau des transactions
      if (transactions.length > 0) {
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .text('Détail des Transactions:', 50, yPosition);

        yPosition += 20;

        transactions.slice(0, 30).forEach((transaction, index) => {
          if (yPosition > 650) {
            doc.addPage();
            yPosition = 50;
          }

          const date = new Date(transaction.created_at).toLocaleDateString('fr-FR');
          doc.fontSize(8)
             .font('Helvetica')
             .text(date, 50, yPosition)
             .text(transaction.type, 100, yPosition)
             .text(transaction.from_wallet.slice(0, 10), 150, yPosition)
             .text(transaction.to_wallet.slice(0, 10), 230, yPosition)
             .text(`${parseFloat(transaction.amount).toLocaleString('fr-FR')} XOF`, 310, yPosition)
             .text(transaction.status, 380, yPosition);

          yPosition += 12;
        });
      }

      resolve();
    });
  });
}

function generateLoanContract(doc, client, yPosition) {
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .text('ARTICLE 1 - OBJET', 50, yPosition)
     .font('Helvetica')
     .text('Le présent contrat a pour objet de définir les conditions dans lesquelles ADOUAS-MC accorde un prêt de micro crédit au Client.', 50, yPosition + 15, { width: 500 });

  yPosition += 50;

  doc.fontSize(11)
     .font('Helvetica-Bold')
     .text('ARTICLE 2 - MONTANT ET CONDITIONS', 50, yPosition)
     .font('Helvetica')
     .text(`• Client: ${client.name}`, 60, yPosition + 15)
     .text(`• Numéro de compte: ${client.wallet_address}`, 60, yPosition + 30)
     .text('• Montant du prêt: [À COMPLÉTER] XOF', 60, yPosition + 45)
     .text('• Taux d\'intérêt: [À COMPLÉTER] %', 60, yPosition + 60)
     .text('• Durée: [À COMPLÉTER] mois', 60, yPosition + 75);
}

function generateRenewalContract(doc, client, yPosition) {
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .text('AVENANT DE RENOUVELLEMENT', 50, yPosition)
     .font('Helvetica')
     .text('Le présent avenant a pour objet de renouveler le contrat de prêt existant sous de nouvelles conditions.', 50, yPosition + 20, { width: 500 });
}

function generatePaymentSchedule(doc, client, yPosition) {
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .text('ÉCHÉANCIER DE PAIEMENT', 50, yPosition)
     .font('Helvetica')
     .text('Calendrier détaillé des remboursements:', 50, yPosition + 20);

  // Exemple d'échéancier
  const payments = [
    { date: '2024-01-30', amount: '25,000 XOF' },
    { date: '2024-02-28', amount: '25,000 XOF' },
    { date: '2024-03-30', amount: '25,000 XOF' },
  ];

  payments.forEach((payment, index) => {
    doc.text(`• ${new Date(payment.date).toLocaleDateString('fr-FR')}: ${payment.amount}`, 60, yPosition + 40 + (index * 15));
  });
}

async function generateLoanReport(doc, startDate, endDate, yPosition) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT l.*, c.name as client_name 
      FROM loans l 
      JOIN clients c ON l.client_id = c.id 
      WHERE l.start_date BETWEEN ? AND ?
    `;

    db.all(query, [startDate, endDate], (err, loans) => {
      if (err) {
        doc.fontSize(12).text('Erreur lors de la récupération des prêts', 50, yPosition);
        resolve();
        return;
      }

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text(`Total des prêts: ${loans.length}`, 50, yPosition);

      resolve();
    });
  });
}

async function generateClientReport(doc, yPosition) {
  return new Promise((resolve, reject) => {
    db.all('SELECT COUNT(*) as total, COUNT(CASE WHEN created_at > date("now", "-30 days") THEN 1 END) as new_clients FROM clients', (err, result) => {
      if (err) {
        doc.fontSize(12).text('Erreur lors de la récupération des clients', 50, yPosition);
        resolve();
        return;
      }

      const stats = result[0];
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text(`Clients totaux: ${stats.total}`, 50, yPosition)
         .text(`Nouveaux clients (30j): ${stats.new_clients}`, 50, yPosition + 15);

      resolve();
    });
  });
}

async function generateFinancialReport(doc, startDate, endDate, yPosition) {
  return new Promise((resolve, reject) => {
    // Récupérer les statistiques financières
    const queries = [
      'SELECT SUM(amount) as total FROM transactions WHERE type = "pret" AND created_at BETWEEN ? AND ?',
      'SELECT SUM(amount) as total FROM transactions WHERE type = "remboursement" AND created_at BETWEEN ? AND ?'
    ];

    Promise.all([
      new Promise(res => db.get(queries[0], [startDate, endDate], (err, row) => res(row))),
      new Promise(res => db.get(queries[1], [startDate, endDate], (err, row) => res(row)))
    ]).then(([prets, remboursements]) => {
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('BILAN FINANCIER', 50, yPosition)
         .font('Helvetica')
         .text(`Prêts accordés: ${parseFloat(prets?.total || 0).toLocaleString('fr-FR')} XOF`, 50, yPosition + 20)
         .text(`Remboursements reçus: ${parseFloat(remboursements?.total || 0).toLocaleString('fr-FR')} XOF`, 50, yPosition + 35);

      resolve();
    }).catch(err => {
      doc.fontSize(12).text('Erreur lors de la génération du bilan financier', 50, yPosition);
      resolve();
    });
  });
}

module.exports = router;