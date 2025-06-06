const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
const cors = require('cors')({ origin: true }); // Allow CORS for frontend fetch

// Setup Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'tanks@dessertmarine.com',   // your Gmail
    pass: 'awoukyetgbgsbtud'           // your App Password (no spaces)
  }
});

// Define Cloud Function
exports.sendEmail = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    const { to, cc, subject, body } = req.body;

    // Basic validation
    if (!to || !subject || !body) {
      return res.status(400).send('Missing required fields: to, subject, or body');
    }

    const mailOptions = {
      from: 'tanks@dessertmarine.com',
      to: Array.isArray(to) ? to.join(',') : to,   // Support Array or String
      cc: Array.isArray(cc) ? cc.join(',') : cc,   // Support Array or String
      subject: subject,
      html: body
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).send('Failed to send email');
      }
      console.log('Email sent:', info.response);
      return res.status(200).send('Email sent successfully');
    });
  });
});
