const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { db } = require("../firebase"); // adjust path if needed

// Load JSON file
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "interests.json"), "utf8"));

async function uploadBeyond() {
  const beyondData = data.GlobalDB.Beyond;

  // Reference: GlobalDB / Beyond
  const beyondRef = db.collection("GlobalDB").doc("Beyond");

  // 1️⃣ Set root Options array
  await beyondRef.set({
    Options: beyondData.Options
  });

  console.log("✅ Beyond root Options uploaded");

  // 2️⃣ Loop over interest categories
  for (const interest of beyondData.Options) {
    const interestData = beyondData[interest];
    if (!interestData) continue;

    // Sanitize interest name - replace forward slashes with underscores
    const sanitizedInterest = interest.replace(/\//g, '_');

    const interestCollectionRef = beyondRef.collection(sanitizedInterest);

    // 3️⃣ Create Queries document for this interest
    const queriesDocRef = interestCollectionRef.doc("Queries");

    await queriesDocRef.set({
      Options: interestData.Queries.Options
    });

    console.log(`   └─ 🎯 Interest uploaded: ${interest} (as ${sanitizedInterest})`);
  }

  console.log("\n🔥 Beyond (Interests) data uploaded successfully");
}

uploadBeyond()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Upload failed:", err);
    process.exit(1);
  });
