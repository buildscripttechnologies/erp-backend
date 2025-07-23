require('dotenv').config({ path: '../.env' }); const sendEmail = require('./sendEmail');

sendEmail('divyeshvariya16@gmail.com', 'Test', 'This is a test email')
  .then(() => console.log('Email sent'))
  .catch((err) => console.error('Send failed:', err));
