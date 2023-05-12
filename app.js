const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const csv = require('csv-parser');
const stream = require('stream');

const app = express();

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', // Or another email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Use body-parser middleware to parse incoming JSON
app.use(bodyParser.json());

async function getAppNames() {
  let appNames = [];

  await axios.get(process.env.GOOGLE_SHEETS_CSV_URL)
    .then(response => {
      return new Promise((resolve, reject) => {
        const csvStream = csv();
        const dataStream = new stream.PassThrough();
        dataStream.end(Buffer.from(response.data, 'utf-8'));
        dataStream.pipe(csvStream)
          .on('data', (row) => {
            // Assumes app names are under the column 'AppName'
            appNames.push(row['AppName']);
          })
          .on('end', () => {
            console.log('CSV file successfully processed');
            resolve();
          })
          .on('error', (error) => {
            console.error(`Error processing CSV file: ${error}`);
            reject();
          });
      });
    });

  return appNames;
}

app.post('/slack/events', async (req, res) => {
  // Check if this is a challenge request
  if (req.body.type && req.body.type === 'url_verification') {
    // Respond with the challenge
    res.send({ challenge: req.body.challenge });
  } else {
    // It's a regular event, handle it
    if (req.body.event && req.body.event.type === 'message') {
      // We have a message event
      const { text } = req.body.event;
      if (text.includes('app name:')) {
        const appName = text.split('app name:')[1].trim();
        const appNames = await getAppNames();
        if (appNames.includes(appName)) {
          console.log(`App name mentioned: ${appName}`);
          // Send an email
          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: 'recipient@example.com', // The recipient's email address
            subject: `App name mentioned: ${appName}`,
            text: `${appName} which you blocked is being migrated to TJ!`
          };
          transporter.sendMail(mailOptions, function(error, info){
            if (error) {
              console.log(error);
            } else {
              console.log('Email sent: ' + info.response);
            }
          });
        }
      }
    }
    // Always respond with a 200 status for event API
    res.sendStatus(200);
  }
});


const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
