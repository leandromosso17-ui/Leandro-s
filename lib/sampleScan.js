// Pre-baked result that simulates an OCR / vision parse of a prescription photo.
// In production this comes from Claude vision; for the demo it returns instantly
// so the "scan" flow reliably populates the dashboard on stage.

export const SAMPLE_SCAN = {
  doctor: "Dr. Elena Rossi",
  clinic: "Studio Medico San Raffaele",
  date: "2026-07-28",
  patient: "Massimo",
  meds: [
    {
      name: "Bisoprolol",
      dosage: "5 mg",
      form: "tablet",
      purpose: "Heart rate",
      pillsPerDose: 1,
      schedule: ["08:00"],
      inventory: 28,
      pillsPerBox: 28,
      emoji: "🟢",
      instructions: "One tablet each morning.",
    },
    {
      name: "Omeprazole",
      dosage: "20 mg",
      form: "capsule",
      purpose: "Stomach protection",
      pillsPerDose: 1,
      schedule: ["08:00"],
      inventory: 14,
      pillsPerBox: 14,
      emoji: "🟣",
      instructions: "Before breakfast, on an empty stomach.",
    },
    {
      name: "Furosemide",
      dosage: "25 mg",
      form: "tablet",
      purpose: "Fluid / diuretic",
      pillsPerDose: 1,
      schedule: ["08:00", "13:00"],
      inventory: 20,
      pillsPerBox: 20,
      emoji: "🟠",
      instructions: "Morning and early afternoon. Avoid late doses.",
    },
  ],
};
