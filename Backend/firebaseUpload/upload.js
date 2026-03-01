const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { db } = require("../firebase"); // adjust path if needed

// Load JSON file
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "courses.json"), "utf8"));

async function uploadAcademia() {
  const academiaData = data.GlobalDB.Academia;

  // Reference: GlobalDB / Academia
  const academiaRef = db.collection("GlobalDB").doc("Academia");

  // 1️⃣ Set root Options array
  await academiaRef.set({
    Options: academiaData.Options
  });

  console.log("✅ Academia root Options uploaded");

  // 2️⃣ Loop over main categories
  for (const category of academiaData.Options) {
    const categoryData = academiaData[category];
    if (!categoryData) continue;

    const categoryCollectionRef = academiaRef.collection(category);

    // 3️⃣ Create Subjects document
    const subjectsDocRef = categoryCollectionRef.doc("Subjects");

    await subjectsDocRef.set({
      Options: categoryData.Subjects.Options
    });

    console.log(`📂 Category created: ${category}`);

    // 4️⃣ Loop subjects
    for (const subject of categoryData.Subjects.Options) {
      const subjectData = categoryData.Subjects[subject];
      if (!subjectData) continue;

      const subjectCollectionRef = subjectsDocRef.collection(subject);
      const queriesDocRef = subjectCollectionRef.doc("Queries");

      // 5️⃣ Add Queries options
      await queriesDocRef.set({
        Options: subjectData.Queries.Options
      });

      console.log(`   └─ 📘 Subject uploaded: ${subject}`);
    }
  }

  console.log("\n🔥 Academia data uploaded successfully");
}

uploadAcademia()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Upload failed:", err);
    process.exit(1);
  });
