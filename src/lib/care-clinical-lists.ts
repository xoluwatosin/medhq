// Universal clinical pick-lists for Medic Connect Care.
//
// Three controlled lists, one source of truth, used by every structured
// clinical control in the questionnaires (family pre-assessment and the
// professional assessment) and by anything that renders a record back.
//
//   MEDICINES   — WHO Model List of Essential Medicines (23rd list, 2023),
//                 by international non-proprietary name, plus the medicines
//                 in routine use in Nigeria that families name by habit.
//   ALLERGENS   — the recognised allergy groups: medicines, foods, insect
//                 stings, environmental and contact allergens.
//   CONDITIONS  — a structured condition list grouped by ICD-11 chapter.
//
// Rules that must hold wherever these are used:
//   * the stored value is always the `code`; labels can be reworded freely;
//   * a list is never exhaustive for a real person, so every control that
//     uses one must also accept free text, stored separately and never
//     silently coerced onto a code;
//   * nothing here is a diagnosis, a prescription, or clinical advice: these
//     are names to choose from so that answers are comparable.
//
// British English throughout (paracetamol, adrenaline, oestrogen).

export interface ClinicalTerm {
  /** Stable stored value. Never reused for a different concept. */
  code: string;
  /** What a person reads. Safe to reword. */
  label: string;
  /** Grouping key within the list. */
  group: string;
  /** Other names people search by: brands, spellings, local usage. */
  synonyms?: string[];
  /** Retired terms stay readable on old records but cannot be chosen again. */
  active?: boolean;
}

export interface TermGroup {
  code: string;
  label: string;
}

const term = (
  group: string,
  label: string,
  synonyms?: string[],
): ClinicalTerm => ({ code: toClinicalCode(label), label, group, synonyms });

/** The one way a clinical name becomes a stable code. */
export const toClinicalCode = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/* ------------------------------------------------------------------ */
/* Medicines                                                           */
/* ------------------------------------------------------------------ */

export const MEDICINE_GROUPS: TermGroup[] = [
  { code: "pain_fever", label: "Pain and fever" },
  { code: "anti_inflammatory", label: "Anti-inflammatory and steroid" },
  { code: "antibiotic", label: "Antibiotic" },
  { code: "antimalarial", label: "Antimalarial" },
  { code: "antiviral_antifungal", label: "Antiviral and antifungal" },
  { code: "tuberculosis", label: "Tuberculosis" },
  { code: "heart_circulation", label: "Heart, blood pressure and circulation" },
  { code: "blood", label: "Blood, clotting and anaemia" },
  { code: "diabetes", label: "Diabetes and hormones" },
  { code: "breathing", label: "Breathing and chest" },
  { code: "stomach", label: "Stomach, gut and liver" },
  { code: "brain_nerves", label: "Brain, nerves and epilepsy" },
  { code: "mental_health", label: "Mental health" },
  { code: "allergy", label: "Allergy and antihistamine" },
  { code: "urinary_kidney", label: "Urinary, kidney and prostate" },
  { code: "womens_health", label: "Women's health and pregnancy" },
  { code: "bones_joints", label: "Bones, joints and gout" },
  { code: "eyes_ears_skin", label: "Eyes, ears and skin" },
  { code: "cancer_immune", label: "Cancer and immune system" },
  { code: "vitamins_supplements", label: "Vitamins, minerals and supplements" },
  { code: "emergency", label: "Emergency and rescue medicines" },
  { code: "other_medicine", label: "Other medicine" },
];

export const MEDICINES: ClinicalTerm[] = [
  // Pain and fever
  term("pain_fever", "Paracetamol", ["acetaminophen", "panadol", "emzor paracetamol"]),
  term("pain_fever", "Ibuprofen", ["brufen", "nurofen"]),
  term("pain_fever", "Aspirin", ["acetylsalicylic acid"]),
  term("pain_fever", "Diclofenac", ["voltaren", "cataflam"]),
  term("pain_fever", "Naproxen"),
  term("pain_fever", "Celecoxib"),
  term("pain_fever", "Codeine"),
  term("pain_fever", "Dihydrocodeine"),
  term("pain_fever", "Tramadol"),
  term("pain_fever", "Morphine"),
  term("pain_fever", "Oxycodone"),
  term("pain_fever", "Fentanyl"),
  term("pain_fever", "Pethidine", ["meperidine"]),
  term("pain_fever", "Pentazocine"),
  term("pain_fever", "Hyoscine butylbromide", ["buscopan"]),
  term("pain_fever", "Paracetamol and codeine"),

  // Anti-inflammatory and steroid
  term("anti_inflammatory", "Prednisolone"),
  term("anti_inflammatory", "Prednisone"),
  term("anti_inflammatory", "Dexamethasone"),
  term("anti_inflammatory", "Hydrocortisone"),
  term("anti_inflammatory", "Methylprednisolone"),
  term("anti_inflammatory", "Betamethasone"),
  term("anti_inflammatory", "Triamcinolone"),
  term("anti_inflammatory", "Colchicine"),

  // Antibiotics
  term("antibiotic", "Amoxicillin"),
  term("antibiotic", "Amoxicillin with clavulanic acid", ["co-amoxiclav", "augmentin"]),
  term("antibiotic", "Ampicillin"),
  term("antibiotic", "Benzylpenicillin", ["penicillin G"]),
  term("antibiotic", "Phenoxymethylpenicillin", ["penicillin V"]),
  term("antibiotic", "Benzathine benzylpenicillin"),
  term("antibiotic", "Cloxacillin"),
  term("antibiotic", "Flucloxacillin"),
  term("antibiotic", "Piperacillin with tazobactam"),
  term("antibiotic", "Cefalexin", ["cephalexin"]),
  term("antibiotic", "Cefuroxime", ["zinnat"]),
  term("antibiotic", "Cefixime"),
  term("antibiotic", "Ceftriaxone", ["rocephin"]),
  term("antibiotic", "Cefotaxime"),
  term("antibiotic", "Ceftazidime"),
  term("antibiotic", "Cefazolin"),
  term("antibiotic", "Meropenem"),
  term("antibiotic", "Imipenem with cilastatin"),
  term("antibiotic", "Azithromycin", ["zithromax"]),
  term("antibiotic", "Erythromycin"),
  term("antibiotic", "Clarithromycin"),
  term("antibiotic", "Clindamycin"),
  term("antibiotic", "Ciprofloxacin", ["ciprotab"]),
  term("antibiotic", "Levofloxacin"),
  term("antibiotic", "Ofloxacin"),
  term("antibiotic", "Moxifloxacin"),
  term("antibiotic", "Doxycycline"),
  term("antibiotic", "Tetracycline"),
  term("antibiotic", "Metronidazole", ["flagyl"]),
  term("antibiotic", "Tinidazole"),
  term("antibiotic", "Nitrofurantoin"),
  term("antibiotic", "Trimethoprim"),
  term("antibiotic", "Sulfamethoxazole with trimethoprim", ["co-trimoxazole", "septrin", "bactrim"]),
  term("antibiotic", "Gentamicin"),
  term("antibiotic", "Amikacin"),
  term("antibiotic", "Vancomycin"),
  term("antibiotic", "Linezolid"),
  term("antibiotic", "Chloramphenicol"),
  term("antibiotic", "Fosfomycin"),

  // Antimalarials
  term("antimalarial", "Artemether with lumefantrine", ["coartem", "lonart", "ACT"]),
  term("antimalarial", "Artesunate"),
  term("antimalarial", "Artesunate with amodiaquine"),
  term("antimalarial", "Dihydroartemisinin with piperaquine", ["P-Alaxin"]),
  term("antimalarial", "Quinine"),
  term("antimalarial", "Chloroquine"),
  term("antimalarial", "Sulfadoxine with pyrimethamine", ["fansidar", "IPTp"]),
  term("antimalarial", "Primaquine"),
  term("antimalarial", "Mefloquine"),
  term("antimalarial", "Proguanil with atovaquone", ["malarone"]),

  // Antivirals and antifungals
  term("antiviral_antifungal", "Aciclovir", ["acyclovir"]),
  term("antiviral_antifungal", "Valaciclovir"),
  term("antiviral_antifungal", "Oseltamivir", ["tamiflu"]),
  term("antiviral_antifungal", "Tenofovir disoproxil"),
  term("antiviral_antifungal", "Lamivudine"),
  term("antiviral_antifungal", "Dolutegravir"),
  term("antiviral_antifungal", "Efavirenz"),
  term("antiviral_antifungal", "Nevirapine"),
  term("antiviral_antifungal", "Abacavir"),
  term("antiviral_antifungal", "Zidovudine"),
  term("antiviral_antifungal", "Ritonavir"),
  term("antiviral_antifungal", "Atazanavir"),
  term("antiviral_antifungal", "Sofosbuvir"),
  term("antiviral_antifungal", "Entecavir"),
  term("antiviral_antifungal", "Fluconazole"),
  term("antiviral_antifungal", "Ketoconazole"),
  term("antiviral_antifungal", "Itraconazole"),
  term("antiviral_antifungal", "Griseofulvin"),
  term("antiviral_antifungal", "Nystatin"),
  term("antiviral_antifungal", "Clotrimazole"),
  term("antiviral_antifungal", "Amphotericin B"),
  term("antiviral_antifungal", "Albendazole"),
  term("antiviral_antifungal", "Mebendazole"),
  term("antiviral_antifungal", "Ivermectin"),
  term("antiviral_antifungal", "Praziquantel"),

  // Tuberculosis
  term("tuberculosis", "Isoniazid"),
  term("tuberculosis", "Rifampicin"),
  term("tuberculosis", "Pyrazinamide"),
  term("tuberculosis", "Ethambutol"),
  term("tuberculosis", "Rifampicin, isoniazid, pyrazinamide and ethambutol", ["RHZE", "TB combination"]),
  term("tuberculosis", "Bedaquiline"),

  // Heart, blood pressure and circulation
  term("heart_circulation", "Amlodipine"),
  term("heart_circulation", "Nifedipine"),
  term("heart_circulation", "Lisinopril"),
  term("heart_circulation", "Enalapril"),
  term("heart_circulation", "Ramipril"),
  term("heart_circulation", "Losartan"),
  term("heart_circulation", "Valsartan"),
  term("heart_circulation", "Telmisartan"),
  term("heart_circulation", "Atenolol"),
  term("heart_circulation", "Bisoprolol"),
  term("heart_circulation", "Metoprolol"),
  term("heart_circulation", "Carvedilol"),
  term("heart_circulation", "Propranolol"),
  term("heart_circulation", "Hydrochlorothiazide"),
  term("heart_circulation", "Furosemide", ["lasix", "frusemide"]),
  term("heart_circulation", "Spironolactone"),
  term("heart_circulation", "Digoxin"),
  term("heart_circulation", "Methyldopa"),
  term("heart_circulation", "Hydralazine"),
  term("heart_circulation", "Isosorbide dinitrate"),
  term("heart_circulation", "Glyceryl trinitrate", ["GTN", "nitroglycerin"]),
  term("heart_circulation", "Atorvastatin"),
  term("heart_circulation", "Simvastatin"),
  term("heart_circulation", "Rosuvastatin"),
  term("heart_circulation", "Ivabradine"),

  // Blood, clotting and anaemia
  term("blood", "Warfarin"),
  term("blood", "Rivaroxaban"),
  term("blood", "Apixaban"),
  term("blood", "Heparin"),
  term("blood", "Enoxaparin", ["clexane", "low molecular weight heparin"]),
  term("blood", "Clopidogrel"),
  term("blood", "Tranexamic acid"),
  term("blood", "Ferrous sulfate", ["iron tablets"]),
  term("blood", "Ferrous fumarate"),
  term("blood", "Folic acid"),
  term("blood", "Hydroxycarbamide", ["hydroxyurea"]),
  term("blood", "Erythropoietin"),
  term("blood", "Phytomenadione", ["vitamin K"]),

  // Diabetes and hormones
  term("diabetes", "Metformin"),
  term("diabetes", "Glibenclamide"),
  term("diabetes", "Gliclazide"),
  term("diabetes", "Glimepiride"),
  term("diabetes", "Sitagliptin"),
  term("diabetes", "Empagliflozin"),
  term("diabetes", "Dapagliflozin"),
  term("diabetes", "Insulin (soluble, short acting)", ["actrapid"]),
  term("diabetes", "Insulin (intermediate acting)", ["insulatard", "NPH"]),
  term("diabetes", "Insulin glargine", ["lantus"]),
  term("diabetes", "Insulin mixed", ["mixtard", "premixed insulin"]),
  term("diabetes", "Levothyroxine", ["thyroxine"]),
  term("diabetes", "Carbimazole"),
  term("diabetes", "Propylthiouracil"),
  term("diabetes", "Desmopressin"),
  term("diabetes", "Fludrocortisone"),

  // Breathing and chest
  term("breathing", "Salbutamol", ["ventolin", "albuterol", "inhaler"]),
  term("breathing", "Salmeterol"),
  term("breathing", "Formoterol"),
  term("breathing", "Beclometasone inhaler"),
  term("breathing", "Budesonide inhaler"),
  term("breathing", "Fluticasone inhaler"),
  term("breathing", "Ipratropium bromide"),
  term("breathing", "Tiotropium"),
  term("breathing", "Montelukast"),
  term("breathing", "Aminophylline"),
  term("breathing", "Theophylline"),
  term("breathing", "Carbocisteine"),
  term("breathing", "Oxygen"),

  // Stomach, gut and liver
  term("stomach", "Omeprazole"),
  term("stomach", "Esomeprazole"),
  term("stomach", "Pantoprazole"),
  term("stomach", "Lansoprazole"),
  term("stomach", "Ranitidine", ["zantac"]),
  term("stomach", "Famotidine"),
  term("stomach", "Antacid (magnesium and aluminium)", ["gestid", "maalox"]),
  term("stomach", "Metoclopramide"),
  term("stomach", "Domperidone"),
  term("stomach", "Ondansetron"),
  term("stomach", "Promethazine"),
  term("stomach", "Loperamide"),
  term("stomach", "Oral rehydration salts", ["ORS", "salt and sugar solution"]),
  term("stomach", "Zinc sulfate"),
  term("stomach", "Lactulose"),
  term("stomach", "Bisacodyl"),
  term("stomach", "Senna"),
  term("stomach", "Mesalazine"),
  term("stomach", "Ursodeoxycholic acid"),
  term("stomach", "Pancreatic enzymes"),

  // Brain, nerves and epilepsy
  term("brain_nerves", "Carbamazepine"),
  term("brain_nerves", "Sodium valproate", ["valproic acid", "epilim"]),
  term("brain_nerves", "Phenytoin"),
  term("brain_nerves", "Phenobarbital", ["phenobarbitone"]),
  term("brain_nerves", "Levetiracetam", ["keppra"]),
  term("brain_nerves", "Lamotrigine"),
  term("brain_nerves", "Topiramate"),
  term("brain_nerves", "Clonazepam"),
  term("brain_nerves", "Diazepam"),
  term("brain_nerves", "Lorazepam"),
  term("brain_nerves", "Midazolam"),
  term("brain_nerves", "Gabapentin"),
  term("brain_nerves", "Pregabalin"),
  term("brain_nerves", "Amitriptyline"),
  term("brain_nerves", "Levodopa with carbidopa"),
  term("brain_nerves", "Donepezil"),
  term("brain_nerves", "Memantine"),
  term("brain_nerves", "Baclofen"),
  term("brain_nerves", "Sumatriptan"),
  term("brain_nerves", "Betahistine"),

  // Mental health
  term("mental_health", "Fluoxetine"),
  term("mental_health", "Sertraline"),
  term("mental_health", "Citalopram"),
  term("mental_health", "Escitalopram"),
  term("mental_health", "Paroxetine"),
  term("mental_health", "Venlafaxine"),
  term("mental_health", "Mirtazapine"),
  term("mental_health", "Imipramine"),
  term("mental_health", "Haloperidol"),
  term("mental_health", "Risperidone"),
  term("mental_health", "Olanzapine"),
  term("mental_health", "Quetiapine"),
  term("mental_health", "Chlorpromazine"),
  term("mental_health", "Aripiprazole"),
  term("mental_health", "Fluphenazine decanoate"),
  term("mental_health", "Lithium carbonate"),
  term("mental_health", "Zopiclone"),
  term("mental_health", "Methylphenidate"),

  // Allergy and antihistamine
  term("allergy", "Cetirizine"),
  term("allergy", "Loratadine"),
  term("allergy", "Chlorphenamine", ["piriton", "chlorpheniramine"]),
  term("allergy", "Fexofenadine"),
  term("allergy", "Desloratadine"),
  term("allergy", "Hydroxyzine"),

  // Urinary, kidney and prostate
  term("urinary_kidney", "Tamsulosin"),
  term("urinary_kidney", "Finasteride"),
  term("urinary_kidney", "Oxybutynin"),
  term("urinary_kidney", "Solifenacin"),
  term("urinary_kidney", "Sildenafil"),
  term("urinary_kidney", "Allopurinol"),
  term("urinary_kidney", "Sevelamer"),
  term("urinary_kidney", "Calcium carbonate (phosphate binder)"),

  // Women's health and pregnancy
  term("womens_health", "Oxytocin"),
  term("womens_health", "Misoprostol"),
  term("womens_health", "Magnesium sulfate"),
  term("womens_health", "Nifedipine (for pre-term labour)"),
  term("womens_health", "Methylergometrine", ["ergometrine"]),
  term("womens_health", "Combined oral contraceptive pill"),
  term("womens_health", "Progestogen-only pill"),
  term("womens_health", "Medroxyprogesterone injection", ["depo-provera"]),
  term("womens_health", "Levonorgestrel implant", ["implanon", "jadelle"]),
  term("womens_health", "Clomifene"),
  term("womens_health", "Oestrogen replacement"),
  term("womens_health", "Domperidone (for milk supply)"),
  term("womens_health", "Anti-D immunoglobulin"),
  term("womens_health", "Pregnancy multivitamin", ["prenatal vitamins", "pregnacare"]),

  // Bones, joints and gout
  term("bones_joints", "Alendronic acid"),
  term("bones_joints", "Calcium with vitamin D"),
  term("bones_joints", "Methotrexate"),
  term("bones_joints", "Sulfasalazine"),
  term("bones_joints", "Hydroxychloroquine"),
  term("bones_joints", "Azathioprine"),
  term("bones_joints", "Febuxostat"),

  // Eyes, ears and skin
  term("eyes_ears_skin", "Chloramphenicol eye drops"),
  term("eyes_ears_skin", "Timolol eye drops"),
  term("eyes_ears_skin", "Latanoprost eye drops"),
  term("eyes_ears_skin", "Artificial tears"),
  term("eyes_ears_skin", "Ciprofloxacin ear drops"),
  term("eyes_ears_skin", "Hydrocortisone cream"),
  term("eyes_ears_skin", "Betamethasone cream"),
  term("eyes_ears_skin", "Emollient or moisturising cream"),
  term("eyes_ears_skin", "Permethrin"),
  term("eyes_ears_skin", "Benzyl benzoate"),
  term("eyes_ears_skin", "Silver sulfadiazine"),
  term("eyes_ears_skin", "Fusidic acid cream"),
  term("eyes_ears_skin", "Calamine lotion"),
  term("eyes_ears_skin", "Chlorhexidine"),
  term("eyes_ears_skin", "Povidone iodine"),

  // Cancer and immune system
  term("cancer_immune", "Tamoxifen"),
  term("cancer_immune", "Cyclophosphamide"),
  term("cancer_immune", "Doxorubicin"),
  term("cancer_immune", "Cisplatin"),
  term("cancer_immune", "Paclitaxel"),
  term("cancer_immune", "Imatinib"),
  term("cancer_immune", "Rituximab"),
  term("cancer_immune", "Trastuzumab"),
  term("cancer_immune", "Ciclosporin"),
  term("cancer_immune", "Tacrolimus"),
  term("cancer_immune", "Mycophenolate mofetil"),
  term("cancer_immune", "Anastrozole"),
  term("cancer_immune", "Bicalutamide"),

  // Vitamins, minerals and supplements
  term("vitamins_supplements", "Vitamin A"),
  term("vitamins_supplements", "Vitamin B complex"),
  term("vitamins_supplements", "Vitamin C", ["ascorbic acid"]),
  term("vitamins_supplements", "Vitamin D", ["cholecalciferol"]),
  term("vitamins_supplements", "Vitamin B12", ["cyanocobalamin"]),
  term("vitamins_supplements", "Multivitamin"),
  term("vitamins_supplements", "Calcium supplement"),
  term("vitamins_supplements", "Magnesium supplement"),
  term("vitamins_supplements", "Potassium chloride"),
  term("vitamins_supplements", "Zinc supplement"),
  term("vitamins_supplements", "Omega-3 fish oil"),
  term("vitamins_supplements", "Herbal or traditional preparation", ["agbo", "herbal mixture"]),

  // Emergency and rescue medicines
  term("emergency", "Adrenaline", ["epinephrine", "EpiPen", "adrenaline auto-injector"]),
  term("emergency", "Glucagon"),
  term("emergency", "Naloxone"),
  term("emergency", "Rescue buccal midazolam"),
  term("emergency", "Glyceryl trinitrate spray"),
  term("emergency", "Salbutamol rescue inhaler"),
  term("emergency", "Dextrose 50% (for low blood sugar)"),
];

/* ------------------------------------------------------------------ */
/* Allergens                                                           */
/* ------------------------------------------------------------------ */

export const ALLERGEN_GROUPS: TermGroup[] = [
  { code: "medicine_allergy", label: "Medicine" },
  { code: "food_allergy", label: "Food" },
  { code: "insect_allergy", label: "Insect sting or bite" },
  { code: "environment_allergy", label: "In the air or around the home" },
  { code: "contact_allergy", label: "Touched on the skin" },
  { code: "other_allergy", label: "Other" },
];

export const ALLERGENS: ClinicalTerm[] = [
  // Medicines — the classes that cause most reactions
  term("medicine_allergy", "Penicillin"),
  term("medicine_allergy", "Amoxicillin"),
  term("medicine_allergy", "Cephalosporin antibiotics", ["ceftriaxone", "cefuroxime"]),
  term("medicine_allergy", "Sulfa antibiotics", ["septrin", "co-trimoxazole", "sulfonamide"]),
  term("medicine_allergy", "Quinolone antibiotics", ["ciprofloxacin", "levofloxacin"]),
  term("medicine_allergy", "Macrolide antibiotics", ["erythromycin", "azithromycin"]),
  term("medicine_allergy", "Tetracycline antibiotics", ["doxycycline"]),
  term("medicine_allergy", "Metronidazole"),
  term("medicine_allergy", "Aspirin"),
  term("medicine_allergy", "Ibuprofen and similar anti-inflammatories", ["NSAID", "diclofenac"]),
  term("medicine_allergy", "Paracetamol"),
  term("medicine_allergy", "Codeine or other opioids", ["morphine", "tramadol"]),
  term("medicine_allergy", "Chloroquine"),
  term("medicine_allergy", "Sulfadoxine with pyrimethamine", ["fansidar"]),
  term("medicine_allergy", "Artemisinin antimalarials", ["coartem", "artemether"]),
  term("medicine_allergy", "Anti-tuberculosis medicines", ["isoniazid", "rifampicin"]),
  term("medicine_allergy", "Antiretroviral medicines", ["nevirapine", "abacavir"]),
  term("medicine_allergy", "Anti-epileptic medicines", ["carbamazepine", "phenytoin", "lamotrigine"]),
  term("medicine_allergy", "Insulin"),
  term("medicine_allergy", "Heparin"),
  term("medicine_allergy", "Local anaesthetic", ["lidocaine"]),
  term("medicine_allergy", "General anaesthetic"),
  term("medicine_allergy", "Contrast dye used in scans", ["iodinated contrast"]),
  term("medicine_allergy", "Vaccine"),
  term("medicine_allergy", "Herbal or traditional preparation"),

  // Foods — the recognised major allergen groups plus local staples
  term("food_allergy", "Cow's milk", ["dairy", "lactose", "milk protein"]),
  term("food_allergy", "Egg"),
  term("food_allergy", "Peanut", ["groundnut"]),
  term("food_allergy", "Tree nuts", ["cashew", "almond", "walnut"]),
  term("food_allergy", "Fish"),
  term("food_allergy", "Shellfish and crustaceans", ["prawn", "crab", "shrimp", "crayfish"]),
  term("food_allergy", "Molluscs", ["periwinkle", "snail"]),
  term("food_allergy", "Soya", ["soy"]),
  term("food_allergy", "Wheat and gluten"),
  term("food_allergy", "Sesame"),
  term("food_allergy", "Mustard"),
  term("food_allergy", "Celery"),
  term("food_allergy", "Lupin"),
  term("food_allergy", "Sulphites", ["preservative"]),
  term("food_allergy", "Maize", ["corn"]),
  term("food_allergy", "Soursop, mango or other fruit"),
  term("food_allergy", "Tomato"),
  term("food_allergy", "Beans"),
  term("food_allergy", "Melon seed", ["egusi"]),
  term("food_allergy", "Palm oil"),
  term("food_allergy", "Food colouring or additive"),
  term("food_allergy", "Monosodium glutamate", ["MSG", "seasoning cube"]),

  // Insect
  term("insect_allergy", "Bee sting"),
  term("insect_allergy", "Wasp or hornet sting"),
  term("insect_allergy", "Ant bite"),
  term("insect_allergy", "Mosquito bite"),
  term("insect_allergy", "Tsetse fly or other fly bite"),
  term("insect_allergy", "Scorpion sting"),

  // Environmental
  term("environment_allergy", "House dust mite", ["dust"]),
  term("environment_allergy", "Pollen and grass", ["hay fever"]),
  term("environment_allergy", "Mould and damp"),
  term("environment_allergy", "Animal fur", ["cat", "dog", "pet dander"]),
  term("environment_allergy", "Cockroach"),
  term("environment_allergy", "Smoke", ["firewood smoke", "cigarette smoke"]),
  term("environment_allergy", "Perfume and air freshener"),
  term("environment_allergy", "Cold air"),
  term("environment_allergy", "Harmattan dust"),

  // Contact
  term("contact_allergy", "Latex", ["rubber gloves"]),
  term("contact_allergy", "Sticking plaster or adhesive tape"),
  term("contact_allergy", "Nickel and costume jewellery"),
  term("contact_allergy", "Soap or detergent"),
  term("contact_allergy", "Antiseptic", ["chlorhexidine", "iodine"]),
  term("contact_allergy", "Hair dye and relaxer"),
  term("contact_allergy", "Cosmetics and body cream"),
  term("contact_allergy", "Sunscreen"),
  term("contact_allergy", "Wound dressing"),
];

/** How severe a recorded reaction was. Stored as the code. */
export const ALLERGY_SEVERITIES: TermGroup[] = [
  { code: "mild", label: "Mild" },
  { code: "moderate", label: "Moderate" },
  { code: "severe", label: "Severe" },
  { code: "anaphylaxis", label: "Anaphylaxis (needed emergency treatment)" },
  { code: "unknown_severity", label: "Not known" },
];

/** What the reaction looked like. Several may be recorded together. */
export const ALLERGY_REACTIONS: TermGroup[] = [
  { code: "rash", label: "Rash or hives" },
  { code: "itching", label: "Itching" },
  { code: "swelling", label: "Swelling of the face, lips or tongue" },
  { code: "breathing_difficulty", label: "Difficulty breathing or wheezing" },
  { code: "vomiting", label: "Vomiting" },
  { code: "diarrhoea", label: "Diarrhoea" },
  { code: "stomach_pain", label: "Stomach pain" },
  { code: "dizziness", label: "Dizziness or fainting" },
  { code: "collapse", label: "Collapse or loss of consciousness" },
  { code: "blisters", label: "Blistering or peeling skin" },
  { code: "other_reaction", label: "Something else" },
];

/* ------------------------------------------------------------------ */
/* Conditions                                                          */
/* ------------------------------------------------------------------ */

export const CONDITION_GROUPS: TermGroup[] = [
  { code: "infection", label: "Infections" },
  { code: "cancer", label: "Cancer and growths" },
  { code: "blood_condition", label: "Blood and immune system" },
  { code: "endocrine", label: "Hormones, diabetes and nutrition" },
  { code: "mental_condition", label: "Mental health" },
  { code: "neurodevelopment", label: "Learning, development and neurodiversity" },
  { code: "neurological", label: "Brain and nervous system" },
  { code: "eye_ear", label: "Eyes and ears" },
  { code: "circulatory", label: "Heart and circulation" },
  { code: "respiratory", label: "Lungs and breathing" },
  { code: "digestive", label: "Stomach, gut and liver" },
  { code: "skin_condition", label: "Skin" },
  { code: "musculoskeletal", label: "Bones, joints and muscles" },
  { code: "kidney_urinary", label: "Kidneys and urinary system" },
  { code: "pregnancy_condition", label: "Pregnancy, birth and after birth" },
  { code: "newborn_condition", label: "Newborn and infancy" },
  { code: "congenital", label: "Conditions present from birth" },
  { code: "injury", label: "Injury and its effects" },
  { code: "functioning", label: "Mobility, memory and daily living" },
  { code: "other_condition", label: "Other condition" },
];

export const CONDITIONS: ClinicalTerm[] = [
  // Infections
  term("infection", "Malaria"),
  term("infection", "Typhoid fever"),
  term("infection", "Tuberculosis", ["TB"]),
  term("infection", "HIV"),
  term("infection", "Hepatitis B"),
  term("infection", "Hepatitis C"),
  term("infection", "Pneumonia"),
  term("infection", "Urinary tract infection", ["UTI"]),
  term("infection", "Gastroenteritis", ["diarrhoea and vomiting"]),
  term("infection", "Cholera"),
  term("infection", "Measles"),
  term("infection", "Chickenpox"),
  term("infection", "Meningitis"),
  term("infection", "Sepsis", ["blood infection"]),
  term("infection", "COVID-19"),
  term("infection", "Lassa fever"),
  term("infection", "Schistosomiasis", ["bilharzia"]),
  term("infection", "Intestinal worms"),
  term("infection", "Sexually transmitted infection"),
  term("infection", "Wound or surgical site infection"),

  // Cancer
  term("cancer", "Breast cancer"),
  term("cancer", "Cervical cancer"),
  term("cancer", "Prostate cancer"),
  term("cancer", "Colorectal cancer", ["bowel cancer"]),
  term("cancer", "Liver cancer"),
  term("cancer", "Lung cancer"),
  term("cancer", "Stomach cancer"),
  term("cancer", "Leukaemia"),
  term("cancer", "Lymphoma"),
  term("cancer", "Cancer of another kind"),
  term("cancer", "Benign growth or fibroid"),

  // Blood and immune
  term("blood_condition", "Sickle cell disease", ["SS", "SC", "sickle cell anaemia"]),
  term("blood_condition", "Sickle cell trait", ["AS"]),
  term("blood_condition", "Anaemia"),
  term("blood_condition", "Iron deficiency"),
  term("blood_condition", "Haemophilia or bleeding disorder"),
  term("blood_condition", "Thalassaemia"),
  term("blood_condition", "G6PD deficiency"),
  term("blood_condition", "Low immunity", ["immunosuppression"]),
  term("blood_condition", "Blood clot", ["deep vein thrombosis", "DVT", "pulmonary embolism"]),

  // Hormones, diabetes and nutrition
  term("endocrine", "Type 1 diabetes"),
  term("endocrine", "Type 2 diabetes"),
  term("endocrine", "Gestational diabetes"),
  term("endocrine", "Underactive thyroid", ["hypothyroidism"]),
  term("endocrine", "Overactive thyroid", ["hyperthyroidism"]),
  term("endocrine", "Obesity"),
  term("endocrine", "Malnutrition or underweight"),
  term("endocrine", "High cholesterol"),
  term("endocrine", "Gout"),
  term("endocrine", "Adrenal insufficiency"),

  // Mental health
  term("mental_condition", "Depression"),
  term("mental_condition", "Anxiety"),
  term("mental_condition", "Postnatal depression"),
  term("mental_condition", "Bipolar disorder"),
  term("mental_condition", "Schizophrenia"),
  term("mental_condition", "Post-traumatic stress"),
  term("mental_condition", "Obsessive compulsive disorder"),
  term("mental_condition", "Eating disorder"),
  term("mental_condition", "Alcohol dependence"),
  term("mental_condition", "Substance dependence"),
  term("mental_condition", "Insomnia or sleep difficulty"),

  // Learning, development and neurodiversity
  term("neurodevelopment", "Autism"),
  term("neurodevelopment", "Attention deficit hyperactivity disorder", ["ADHD"]),
  term("neurodevelopment", "Learning disability"),
  term("neurodevelopment", "Global developmental delay"),
  term("neurodevelopment", "Speech and language delay"),
  term("neurodevelopment", "Dyslexia"),
  term("neurodevelopment", "Down syndrome"),
  term("neurodevelopment", "Cerebral palsy"),

  // Brain and nervous system
  term("neurological", "Stroke"),
  term("neurological", "Transient ischaemic attack", ["mini stroke", "TIA"]),
  term("neurological", "Epilepsy or seizures"),
  term("neurological", "Dementia"),
  term("neurological", "Alzheimer's disease"),
  term("neurological", "Parkinson's disease"),
  term("neurological", "Multiple sclerosis"),
  term("neurological", "Migraine"),
  term("neurological", "Nerve pain", ["neuropathy"]),
  term("neurological", "Spinal cord injury"),
  term("neurological", "Brain injury"),
  term("neurological", "Motor neurone disease"),

  // Eyes and ears
  term("eye_ear", "Cataract"),
  term("eye_ear", "Glaucoma"),
  term("eye_ear", "Blindness or low vision"),
  term("eye_ear", "Diabetic eye disease"),
  term("eye_ear", "Hearing loss or deafness"),
  term("eye_ear", "Ear infection"),
  term("eye_ear", "Vertigo"),

  // Heart and circulation
  term("circulatory", "High blood pressure", ["hypertension"]),
  term("circulatory", "Heart failure"),
  term("circulatory", "Coronary heart disease", ["angina"]),
  term("circulatory", "Previous heart attack"),
  term("circulatory", "Irregular heartbeat", ["atrial fibrillation", "arrhythmia"]),
  term("circulatory", "Heart valve disease"),
  term("circulatory", "Peripheral arterial disease"),
  term("circulatory", "Varicose veins"),
  term("circulatory", "Low blood pressure"),

  // Lungs and breathing
  term("respiratory", "Asthma"),
  term("respiratory", "Chronic obstructive pulmonary disease", ["COPD"]),
  term("respiratory", "Sleep apnoea"),
  term("respiratory", "Chronic cough"),
  term("respiratory", "Bronchiectasis"),
  term("respiratory", "Allergic rhinitis", ["hay fever"]),
  term("respiratory", "Sinusitis"),

  // Stomach, gut and liver
  term("digestive", "Acid reflux", ["GERD", "heartburn"]),
  term("digestive", "Peptic ulcer"),
  term("digestive", "Irritable bowel syndrome", ["IBS"]),
  term("digestive", "Inflammatory bowel disease", ["Crohn's", "ulcerative colitis"]),
  term("digestive", "Constipation"),
  term("digestive", "Liver disease or cirrhosis"),
  term("digestive", "Gallstones"),
  term("digestive", "Pancreatitis"),
  term("digestive", "Haemorrhoids", ["piles"]),
  term("digestive", "Hernia"),
  term("digestive", "Stoma", ["colostomy", "ileostomy"]),
  term("digestive", "Swallowing difficulty", ["dysphagia"]),

  // Skin
  term("skin_condition", "Eczema"),
  term("skin_condition", "Psoriasis"),
  term("skin_condition", "Pressure sore", ["bed sore", "pressure ulcer"]),
  term("skin_condition", "Leg or foot ulcer"),
  term("skin_condition", "Diabetic foot"),
  term("skin_condition", "Fungal skin infection"),
  term("skin_condition", "Keloid scarring"),
  term("skin_condition", "Albinism"),
  term("skin_condition", "Burns"),

  // Bones, joints and muscles
  term("musculoskeletal", "Osteoarthritis"),
  term("musculoskeletal", "Rheumatoid arthritis"),
  term("musculoskeletal", "Osteoporosis"),
  term("musculoskeletal", "Back pain"),
  term("musculoskeletal", "Previous fracture"),
  term("musculoskeletal", "Hip or knee replacement"),
  term("musculoskeletal", "Amputation"),
  term("musculoskeletal", "Muscular dystrophy"),
  term("musculoskeletal", "Lupus"),
  term("musculoskeletal", "Sickle cell bone pain"),

  // Kidneys and urinary
  term("kidney_urinary", "Chronic kidney disease"),
  term("kidney_urinary", "Kidney failure on dialysis"),
  term("kidney_urinary", "Kidney stones"),
  term("kidney_urinary", "Enlarged prostate"),
  term("kidney_urinary", "Urinary incontinence"),
  term("kidney_urinary", "Urinary catheter in place"),

  // Pregnancy and after birth
  term("pregnancy_condition", "Current pregnancy"),
  term("pregnancy_condition", "Multiple pregnancy", ["twins", "triplets"]),
  term("pregnancy_condition", "Pre-eclampsia"),
  term("pregnancy_condition", "Eclampsia"),
  term("pregnancy_condition", "Caesarean birth"),
  term("pregnancy_condition", "Assisted birth", ["forceps", "vacuum"]),
  term("pregnancy_condition", "Perineal tear or episiotomy"),
  term("pregnancy_condition", "Heavy bleeding after birth", ["postpartum haemorrhage"]),
  term("pregnancy_condition", "Difficulty breastfeeding"),
  term("pregnancy_condition", "Mastitis"),
  term("pregnancy_condition", "Previous miscarriage or stillbirth"),
  term("pregnancy_condition", "Pre-term birth"),

  // Newborn and infancy
  term("newborn_condition", "Low birth weight"),
  term("newborn_condition", "Premature baby"),
  term("newborn_condition", "Newborn jaundice"),
  term("newborn_condition", "Admitted to special care baby unit", ["SCBU", "NICU"]),
  term("newborn_condition", "Feeding difficulty"),
  term("newborn_condition", "Poor weight gain"),
  term("newborn_condition", "Birth asphyxia"),
  term("newborn_condition", "Neonatal infection"),
  term("newborn_condition", "Colic"),
  term("newborn_condition", "Tongue tie"),

  // Present from birth
  term("congenital", "Congenital heart condition", ["hole in the heart"]),
  term("congenital", "Cleft lip or palate"),
  term("congenital", "Spina bifida"),
  term("congenital", "Hydrocephalus"),
  term("congenital", "Club foot"),
  term("congenital", "Congenital hearing loss"),
  term("congenital", "Genetic or inherited condition"),

  // Injury
  term("injury", "Fall in the last year"),
  term("injury", "Road traffic injury"),
  term("injury", "Burn injury"),
  term("injury", "Recent surgery"),
  term("injury", "Wound needing dressing"),

  // Functioning and daily living
  term("functioning", "Difficulty walking"),
  term("functioning", "Uses a wheelchair"),
  term("functioning", "Uses a walking frame or stick"),
  term("functioning", "Bedbound"),
  term("functioning", "Needs help washing or dressing"),
  term("functioning", "Needs help eating"),
  term("functioning", "Memory difficulty"),
  term("functioning", "Confusion or disorientation"),
  term("functioning", "Wandering"),
  term("functioning", "Risk of falls"),
  term("functioning", "Communication difficulty"),
  term("functioning", "Needs help with medicines"),
];

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

const activeOnly = (list: ClinicalTerm[]) => list.filter((t) => t.active !== false);

/** Every code in a list, for validation. */
export const codesIn = (list: ClinicalTerm[]): string[] => list.map((t) => t.code);

/** Label for a stored code. Unknown codes stay visible rather than vanishing. */
export const clinicalLabel = (
  list: ClinicalTerm[],
  code: string | null | undefined,
  fallback = "Not recorded",
): string => {
  if (!code) return fallback;
  return list.find((t) => t.code === code)?.label ?? `Not on the list (${code})`;
};

export const medicineLabel = (code?: string | null) => clinicalLabel(MEDICINES, code);
export const allergenLabel = (code?: string | null) => clinicalLabel(ALLERGENS, code);
export const conditionLabel = (code?: string | null) => clinicalLabel(CONDITIONS, code);

export const groupLabel = (groups: TermGroup[], code?: string | null): string =>
  (code && groups.find((g) => g.code === code)?.label) || "Other";

/**
 * Type-ahead search over a list. Matches on the label first, then on the
 * other names people use. Never guesses: an empty query returns the list in
 * its authored order so a person can simply browse.
 */
export const searchTerms = (
  list: ClinicalTerm[],
  query: string,
  limit = 50,
): ClinicalTerm[] => {
  const q = query.trim().toLowerCase();
  const source = activeOnly(list);
  if (!q) return source.slice(0, limit);

  const starts: ClinicalTerm[] = [];
  const contains: ClinicalTerm[] = [];
  const bySynonym: ClinicalTerm[] = [];

  for (const t of source) {
    const label = t.label.toLowerCase();
    if (label.startsWith(q)) starts.push(t);
    else if (label.includes(q)) contains.push(t);
    else if (t.synonyms?.some((s) => s.toLowerCase().includes(q))) bySynonym.push(t);
    if (starts.length >= limit) break;
  }

  return [...starts, ...contains, ...bySynonym].slice(0, limit);
};

/** A list arranged under its groups, for a browsable picker. */
export const groupedTerms = (
  list: ClinicalTerm[],
  groups: TermGroup[],
): Array<{ group: TermGroup; terms: ClinicalTerm[] }> =>
  groups
    .map((group) => ({ group, terms: activeOnly(list).filter((t) => t.group === group.code) }))
    .filter((entry) => entry.terms.length > 0);

/** The three lists, keyed by the control that uses them. */
export const CLINICAL_LISTS = {
  medicine: { terms: MEDICINES, groups: MEDICINE_GROUPS },
  allergen: { terms: ALLERGENS, groups: ALLERGEN_GROUPS },
  condition: { terms: CONDITIONS, groups: CONDITION_GROUPS },
} as const;

export type ClinicalListName = keyof typeof CLINICAL_LISTS;

/* ------------------------------------------------------------------ */
/* Vocabulary provenance                                               */
/* ------------------------------------------------------------------ */

/**
 * These codes are Medic Connect internal stable codes. They are NOT ICD-11,
 * SNOMED CT or ATC identifiers, even though the lists are grouped clinically.
 * An answer stores the internal code, or the person's own words as explicit
 * free text, and never both. Retired terms keep `active: false` so old records
 * stay readable; they cannot be chosen again.
 *
 * Bump this whenever a term is added, reworded or retired, so a stored answer
 * can always be read against the vocabulary that produced it.
 */
export const CLINICAL_VOCABULARY = "medicconnect-care";
export const CLINICAL_VOCABULARY_VERSION = 1;

const codeSet = (list: ClinicalTerm[]) => new Set(activeOnly(list).map((t) => t.code));

/** Codes that may still be chosen today, per list. */
export const ACTIVE_CODES: Record<ClinicalListName, Set<string>> = {
  medicine: codeSet(MEDICINES),
  allergen: codeSet(ALLERGENS),
  condition: codeSet(CONDITIONS),
};

/** True when the code is a live term in that list. */
export const isActiveCode = (list: ClinicalListName, code: string): boolean =>
  ACTIVE_CODES[list].has(code);
