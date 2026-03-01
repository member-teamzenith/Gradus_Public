const admin = require("firebase-admin");
require('dotenv').config(); // make sure .env is loaded locally

// Parse the full JSON service account from env
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  console.error('ERROR: GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable is not set');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://gradus-26a77.firebaseio.com",
});

const db = admin.firestore();

module.exports = { admin, db };
