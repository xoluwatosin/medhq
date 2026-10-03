// Source of truth: MedicConnect Master Price Book (LIVE rows). Retail prices in NGN.
// Used by the admin invoice catalogue.

export interface DefaultService {
  name: string;
  price: number;
}

export interface DefaultCategory {
  name: string;
  services: DefaultService[];
}

export const DEFAULT_CATALOGUE: DefaultCategory[] = [
  {
    name: "Assessments & Consultations",
    services: [
      { name: "Initial Home Assessment", price: 35000 },
      { name: "Reassessment / Care Plan Review", price: 20000 },
      { name: "Geriatric Comprehensive Assessment", price: 45000 },
      { name: "Paediatric Developmental Assessment", price: 35000 },
      { name: "Mental Health Assessment", price: 40000 },
      { name: "Falls Risk Assessment", price: 25000 },
      { name: "Nutritional Assessment", price: 20000 },
      { name: "Wound Specialist Assessment", price: 25000 },
      { name: "GP Home Visit (Initial)", price: 35000 },
      { name: "GP Follow-Up Visit", price: 25000 },
      { name: "Specialist Home Visit", price: 60000 },
      { name: "Telemedicine — GP", price: 10000 },
      { name: "Telemedicine — Specialist", price: 20000 },
      { name: "Nurse Midwife Visit", price: 15000 },
      { name: "Dietitian Consultation", price: 20000 },
    ],
  },
  {
    name: "Nursing & Daily Care",
    services: [
      { name: "Basic Nursing Visit", price: 12000 },
      { name: "Standard Nursing Visit", price: 18000 },
      { name: "Extended Nursing Visit", price: 25000 },
      { name: "Night Nursing Visit", price: 20000 },
      { name: "Psychiatric Nursing Visit", price: 20000 },
      { name: "Basic Care (Caregiver)", price: 12000 },
      { name: "Intermediate Care (Nurse)", price: 25000 },
      { name: "Intensive Nursing", price: 35000 },
      { name: "24-Hour Nursing (per day)", price: 55000 },
      { name: "Live-In Caregiver (per day)", price: 12000 },
    ],
  },
  {
    name: "Clinical Procedures",
    services: [
      { name: "Wound Dressing — Simple", price: 5000 },
      { name: "Wound Dressing — Complex", price: 10000 },
      { name: "Chronic / Specialist Wound Care", price: 15000 },
      { name: "IV Cannulation + Fluid Admin", price: 8000 },
      { name: "IV Antibiotic Therapy (OPAT)", price: 15000 },
      { name: "Injection (SC/IM)", price: 3000 },
      { name: "Catheter Insertion (Foley)", price: 8000 },
      { name: "Oxygen Therapy Setup", price: 15000 },
      { name: "Nebulisation", price: 5000 },
      { name: "Tracheostomy Care", price: 15000 },
      { name: "Phlebotomy (Blood Draw)", price: 5000 },
      { name: "ECG at Home (12-Lead)", price: 15000 },
    ],
  },
  {
    name: "Maternity & Omugwo",
    services: [
      { name: "Routine ANC Visit (package)", price: 15000 },
      { name: "High-Risk Pregnancy Visit (package)", price: 20000 },
      { name: "Trimester ANC Package", price: 50000 },
      { name: "Postnatal Visit (Mother + Baby)", price: 20000 },
      { name: "Breastfeeding Support", price: 15000 },
      { name: "C-Section Wound Care", price: 10000 },
      { name: "Omugwo Light (~0.4 person-month)", price: 100000 },
      { name: "Omugwo Day Support (~0.6 person-month)", price: 200000 },
      { name: "Omugwo Full 24/7 (~1.3 person-month)", price: 380000 },
      { name: "Post-Caesarean Recovery (~0.8 person-month)", price: 250000 },
    ],
  },
  {
    name: "Chronic, Palliative & Elder",
    services: [
      { name: "Diabetes Home Visit", price: 12000 },
      { name: "Hypertension Home Visit", price: 10000 },
      { name: "Heart Failure Home Visit", price: 15000 },
      { name: "Sickle Cell Home Visit", price: 15000 },
      { name: "Palliative Nursing Visit", price: 25000 },
      { name: "Fall Prevention Visit", price: 15000 },
      { name: "Dementia / Alzheimer's Care Package", price: 500000 },
    ],
  },
  {
    name: "Paediatric, Rehab & Equipment",
    services: [
      { name: "Sick Child Visit", price: 15000 },
      { name: "Neonatal Day Nursing", price: 30000 },
      { name: "ABA Therapy Session", price: 20000 },
      { name: "Sickle Cell Pain Crisis (Mild)", price: 20000 },
      { name: "Physiotherapy — Initial Assessment", price: 25000 },
      { name: "Post-Stroke Recovery Phase 1 (~0.8 person-month)", price: 350000 },
      { name: "O2 Concentrator (5L) Rental (per month)", price: 25000 },
    ],
  },
];
