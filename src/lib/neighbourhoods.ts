/**
 * Lagos neighbourhood configuration for /home-care-* landing pages.
 *
 * Each entry powers a single SEO landing page targeting people searching
 * for home care in their specific area of Lagos. Pages are NOT linked
 * from the main navigation — they are discovered through search.
 *
 * Tone is intentionally traditional ("registered nurses, caregivers,
 * 24/7 cover") to match what people Google locally, not the platform
 * brand voice used on the homepage.
 */

export interface Neighbourhood {
  /** URL slug — final route is /home-care-{slug} */
  slug: string;
  /** Display name as used in copy and titles */
  name: string;
  /** Side of Lagos — used in copy */
  axis: "Island" | "Mainland";
  /** Short blurb appearing in the hero subhead (1–2 sentences). */
  intro: string;
  /** Locally recognisable landmarks and estates we cover */
  landmarks: string[];
  /** Nearby hospitals families typically discharge from */
  nearbyHospitals: string[];
  /** The 3–4 most common care needs in this area, shaped by demographics */
  commonNeeds: { title: string; description: string }[];
  /** Local proof / response-time line */
  responseLine: string;
  /** Two short FAQs unique to this area */
  faqs: { q: string; a: string }[];
  /**
   * Slugs of nearby area pages, linked at the foot of the page. A wider area
   * links down to the estates inside it (Ikoyi to Banana Island) and the
   * estate links back up, so the two pages support rather than compete.
   */
  nearby?: string[];
}

export const NEIGHBOURHOODS: Neighbourhood[] = [
  {
    slug: "ikoyi",
    name: "Ikoyi",
    axis: "Island",
    intro:
      "Registered nurses, vetted caregivers and 24-hour live-in cover for families across Ikoyi. Most placements confirmed the same week.",
    landmarks: [
      "Old Ikoyi (Bourdillon, Glover, Alexander)",
      "Parkview Estate",
      "Banana Island",
      "Dolphin Estate",
      "Osborne Foreshore",
      "Awolowo Road corridor",
    ],
    nearbyHospitals: [
      "Reddington Hospital",
      "Lagoon Hospitals Ikoyi",
      "St. Nicholas Hospital",
      "First Cardiology",
    ],
    commonNeeds: [
      {
        title: "Post-surgical recovery at home",
        description:
          "Many Ikoyi families discharge from Reddington, Lagoon or St. Nicholas and want trained nursing cover for the first two to three weeks. We handle wound care, medication timing and quiet daily vitals.",
      },
      {
        title: "Eldercare for ageing parents",
        description:
          "Dignified live-in or live-out caregivers for elderly parents in Old Ikoyi, Parkview and Banana Island. Personal care, mobility support, medication reminders and companionship.",
      },
      {
        title: "Dementia and stroke recovery",
        description:
          "Specialist caregivers trained in dementia care, post-stroke rehab and palliative support, working alongside your consultant.",
      },
      {
        title: "Diaspora-coordinated care",
        description:
          "Many Ikoyi households are run from London or New York. We bill the family abroad and send per-visit WhatsApp reports so nothing is left to guesswork.",
      },
    ],
    responseLine:
      "We routinely deploy nurses to Ikoyi addresses within 24–48 hours of assessment.",
    faqs: [
      {
        q: "Do you cover Banana Island and Parkview Estate?",
        a: "Yes. We have caregivers and nurses working across Old Ikoyi, Parkview, Banana Island, Dolphin Estate and Osborne Foreshore, including overnight and live-in placements.",
      },
      {
        q: "Can you take over care after discharge from Reddington or Lagoon?",
        a: "Yes. With your consent we collect the discharge summary, medication list and follow-up dates from the hospital and pick up care the day you come home.",
      },
    ],
    nearby: ["banana-island", "parkview", "osborne-foreshore", "victoria-island"],
  },
  {
    slug: "lekki",
    name: "Lekki",
    axis: "Island",
    intro:
      "Trusted home nursing, postnatal support and live-in caregivers across Lekki Phase 1, Chevron, Ikate and along the corridor.",
    landmarks: [
      "Lekki Phase 1",
      "Ikate Elegushi",
      "Chevron Drive",
      "Ikota / Megamound",
      "VGC",
      "Osapa London",
      "Agungi",
    ],
    nearbyHospitals: [
      "Reddington Lekki",
      "Euracare Multi-Specialist Hospital",
      "Mart-Life Medical Centre",
      "Optimal Cancer Care Foundation",
    ],
    commonNeeds: [
      {
        title: "Postnatal care and Omugwo support",
        description:
          "Young Lekki families often don't have parents nearby for traditional Omugwo. Our trained postnatal nurses combine clinical safety (mother's recovery, baby weight, feeding) with the warmth of an experienced carer in the home.",
      },
      {
        title: "Paediatric nurse at home",
        description:
          "Paediatric and neonatal nursing for sick children, premature babies and children with special needs, discharged from Reddington or Euracare.",
      },
      {
        title: "Live-in nanny placement",
        description:
          "Vetted nannies with verified references and background checks for dual-income families across Phase 1, Chevron and VGC.",
      },
      {
        title: "Post-surgical recovery",
        description:
          "Short-stay nursing cover after surgery — caesarean recovery, orthopaedic procedures, day-surgery follow-up — delivered in your home.",
      },
    ],
    responseLine:
      "Lekki is one of our highest-volume areas. Same-week placements are normal; urgent cover is often the same day.",
    faqs: [
      {
        q: "Do you place nannies in Lekki on a live-in basis?",
        a: "Yes. Live-in nannies and live-in caregivers are common in Lekki Phase 1, Chevron, VGC and Ikota. All staff complete background checks, license/reference verification and a physical guarantor process before deployment.",
      },
      {
        q: "How quickly can a postnatal nurse start?",
        a: "For planned deliveries we can have a postnatal nurse in your home the day you come back from hospital. Walk-in requests are usually covered within 48 hours.",
      },
    ],
    nearby: ["lekki-phase-1", "vgc", "ajah", "ikoyi", "victoria-island"],
  },
  {
    slug: "victoria-island",
    name: "Victoria Island",
    axis: "Island",
    intro:
      "Discreet, professional home nursing and caregiver cover for residents and short-stay guests on Victoria Island. Confidentiality and clinical standards as standard.",
    landmarks: [
      "Adeola Odeku",
      "Saka Tinubu",
      "Akin Adesola",
      "Ozumba Mbadiwe",
      "Eko Atlantic",
      "Oniru / Lekki Phase 1 border",
    ],
    nearbyHospitals: [
      "Reddington Hospital VI",
      "Lagoon Hospitals VI",
      "Vedic Lifecare",
      "St. Nicholas Hospital (nearby)",
    ],
    commonNeeds: [
      {
        title: "Short-stay recovery for executives and visitors",
        description:
          "Many of our VI clients are professionals recovering from day surgery, or visitors staying at apartments and hotels who need a nurse for a week or two. We deliver discreetly and bill cleanly.",
      },
      {
        title: "24-hour home nursing",
        description:
          "Round-the-clock registered-nurse cover for serious recovery, chronic illness and palliative care — typically two or three nurses rotated for continuous safety.",
      },
      {
        title: "IV therapy and wound care at home",
        description:
          "Skilled nursing for IV antibiotics, OPAT, dressing changes and post-operative wound monitoring without unnecessary hospital visits.",
      },
      {
        title: "Concierge eldercare",
        description:
          "Dignified live-in or visiting caregivers for ageing parents in serviced apartments and family residences on VI.",
      },
    ],
    responseLine:
      "Same-day cover is often possible on Victoria Island after assessment.",
    faqs: [
      {
        q: "Can you provide a nurse for a relative visiting Lagos and staying at a hotel?",
        a: "Yes. We regularly place nurses with short-stay visitors at hotels and serviced apartments on VI for one to three weeks of recovery cover. We discuss access and discretion with the hotel in advance.",
      },
      {
        q: "Is the nurse in uniform?",
        a: "By default our nurses are in clean professional scrubs with ID. For clients who prefer a discreet presence in apartment buildings, plain clothing with visible ID is available on request.",
      },
    ],
    nearby: ["eko-atlantic", "ikoyi", "lekki-phase-1"],
  },
  {
    slug: "ikeja",
    name: "Ikeja",
    axis: "Mainland",
    intro:
      "Registered nurses and trusted caregivers across Ikeja GRA, Allen, Opebi and Magodo. Trusted by mainland families managing eldercare and post-hospital recovery.",
    landmarks: [
      "Ikeja GRA",
      "Allen Avenue",
      "Opebi",
      "Magodo GRA",
      "Omole Phase 1 & 2",
      "Maryland",
    ],
    nearbyHospitals: [
      "Reddington Hospital Ikeja",
      "First Consultants Medical Centre",
      "Lagos State University Teaching Hospital (LASUTH)",
      "Eko Hospital Ikeja",
    ],
    commonNeeds: [
      {
        title: "Eldercare and companion care",
        description:
          "Long-established families in Ikeja GRA and Magodo often need dignified live-in care for ageing parents — personal care, meals, medication and steady company.",
      },
      {
        title: "Recovery after discharge",
        description:
          "Trained nursing cover for the days and weeks after discharge from LASUTH, Reddington Ikeja or First Consultants. Wound care, vitals, mobility support.",
      },
      {
        title: "Dementia and chronic care",
        description:
          "Specialist caregivers for dementia, Parkinson's, stroke recovery and diabetes-related care plans.",
      },
      {
        title: "Paediatric and special-needs care",
        description:
          "Trained caregivers for children with developmental needs or complex medical conditions across the Ikeja corridor.",
      },
    ],
    responseLine:
      "Ikeja placements are typically confirmed within 48 hours of the home assessment.",
    faqs: [
      {
        q: "Do you cover Magodo and Omole?",
        a: "Yes. Our caregivers and nurses work across Ikeja GRA, Allen, Opebi, Magodo Phase 1 and 2, and Omole Phase 1 and 2, including live-in placements.",
      },
      {
        q: "Can you arrange a nurse after discharge from LASUTH?",
        a: "Yes. With your consent we coordinate with the ward team, collect the discharge plan and start nursing cover the day the patient returns home.",
      },
    ],
    nearby: ["ikeja-gra", "magodo-gra"],
  },
  {
    slug: "ajah",
    name: "Ajah",
    axis: "Island",
    intro:
      "Vetted nannies, postnatal nurses and live-in caregivers across Ajah, Sangotedo, Abraham Adesanya, Lakowe and Awoyaya. Quiet, dependable care for growing families.",
    landmarks: [
      "Ajah roundabout",
      "Sangotedo",
      "Abraham Adesanya",
      "Lakowe",
      "Awoyaya",
      "Crown Estate",
      "Lekki Gardens estates",
    ],
    nearbyHospitals: [
      "Lagoon Hospitals Lekki",
      "Royal Albert Hospital",
      "St. Ives Specialist Hospital",
    ],
    commonNeeds: [
      {
        title: "Postnatal care and Omugwo",
        description:
          "New mothers in Sangotedo, Abraham Adesanya and the Lekki–Epe estates often need a postnatal nurse for the first weeks at home. Mother's recovery, baby weight, feeding support, light overnight cover.",
      },
      {
        title: "Live-in nanny placement",
        description:
          "Vetted, background-checked nannies and child carers placed with families across Ajah and the Lekki–Epe corridor.",
      },
      {
        title: "Paediatric and neonatal nursing",
        description:
          "Trained paediatric nurses for sick children, premature babies and babies discharged from NICU.",
      },
      {
        title: "Eldercare",
        description:
          "Live-in caregivers for elderly parents in family estates along the corridor, with steady support for mobility, medication and daily personal care.",
      },
    ],
    responseLine:
      "We cover the Lekki–Epe corridor as standard. Ajah placements typically confirmed within the week.",
    faqs: [
      {
        q: "How far down the Lekki–Epe expressway do you cover?",
        a: "We cover Ajah, Sangotedo, Abraham Adesanya, Lakowe, Awoyaya and surrounding estates. For addresses further along the corridor, contact us and we'll confirm at assessment.",
      },
      {
        q: "Can a nanny live in the home?",
        a: "Yes. Live-in nannies are common across Ajah estates. Every nanny goes through background checks, reference verification and a physical guarantor process before deployment.",
      },
    ],
    nearby: ["vgc", "lekki"],
  },
  {
    slug: "surulere",
    name: "Surulere",
    axis: "Mainland",
    intro:
      "Trusted home nursing, eldercare and caregiver placement across Surulere, Bode Thomas and Aguda. Steady, respectful care for the families who have lived here for decades.",
    landmarks: [
      "Bode Thomas",
      "Aguda",
      "Adeniran Ogunsanya",
      "Adelabu",
      "Masha",
      "Western Avenue",
      "National Stadium area",
    ],
    nearbyHospitals: [
      "Lagos University Teaching Hospital (LUTH) — nearby Idi-Araba",
      "Randle General Hospital",
      "Havana Specialist Hospital",
    ],
    commonNeeds: [
      {
        title: "Eldercare for multigenerational households",
        description:
          "Many Surulere homes are multigenerational. Our caregivers provide live-in or live-out support to elderly parents and grandparents — meals, bathing, medication, mobility — without disturbing the family rhythm.",
      },
      {
        title: "Post-discharge nursing",
        description:
          "Trained nursing cover after discharge from LUTH and Randle. Wound care, medication management, vitals tracking.",
      },
      {
        title: "Dementia and stroke recovery",
        description:
          "Specialist caregivers and post-stroke rehab support, including help with feeding, transfers and language exercises.",
      },
      {
        title: "Palliative and end-of-life care",
        description:
          "Compassionate palliative nursing at home, with pain management and family support, coordinated with your treating doctor.",
      },
    ],
    responseLine:
      "Surulere placements are typically confirmed within 48 hours.",
    faqs: [
      {
        q: "Do you cover Aguda and Bode Thomas?",
        a: "Yes. Our caregivers and nurses work across all of Surulere — Bode Thomas, Aguda, Adeniran Ogunsanya, Adelabu, Masha and the surrounding streets.",
      },
      {
        q: "Can you take over from a family member who has been caring for our mother?",
        a: "Yes. Many families come to us tired. We assess gently, agree the level of cover that takes pressure off the household, and step in with a trained caregiver — daytime, overnight or live-in.",
      },
    ],
    nearby: ["yaba"],
  },
  {
    slug: "yaba",
    name: "Yaba",
    axis: "Mainland",
    intro:
      "Antenatal, postnatal and paediatric home nursing across Yaba, Akoka, Sabo and Onike. Clinical care for new mothers, babies and recovering patients in the heart of the mainland.",
    landmarks: [
      "Akoka",
      "Sabo",
      "Onike",
      "Jibowu",
      "Abule-Oja",
      "University of Lagos area",
    ],
    nearbyHospitals: [
      "Lagos University Teaching Hospital (LUTH)",
      "Massey Street Children's Hospital",
      "Federal Neuropsychiatric Hospital Yaba",
    ],
    commonNeeds: [
      {
        title: "Antenatal and postnatal care at home",
        description:
          "Antenatal monitoring packages and postnatal nursing for new mothers in Yaba and Akoka. Mother's recovery, baby weight, feeding support, and Omugwo-style care delivered safely.",
      },
      {
        title: "Paediatric home nursing",
        description:
          "Trained paediatric nurses for sick children and babies discharged from LUTH, Massey Street or private hospitals.",
      },
      {
        title: "Post-discharge clinical care",
        description:
          "Skilled nursing cover for adults discharged from LUTH — wound care, IV therapy, vitals monitoring and recovery support.",
      },
      {
        title: "Eldercare",
        description:
          "Caregivers for elderly relatives in long-established Yaba and Akoka households.",
      },
    ],
    responseLine:
      "Yaba placements are typically confirmed within 48 hours of the home assessment.",
    faqs: [
      {
        q: "Do you cover the University of Lagos area and Akoka?",
        a: "Yes. We have caregivers and nurses working across Yaba, Akoka, Sabo, Onike and Abule-Oja, including live-in placements.",
      },
      {
        q: "Can a postnatal nurse come the day we discharge from LUTH?",
        a: "Yes. Once we have completed the home assessment, we can have a postnatal nurse in your home the day you bring your baby home.",
      },
    ],
    nearby: ["surulere"],
  },
  // --- Estates and districts added October 2026. Hospitals are the ones
  // already listed for the surrounding area; claims stay within what the site
  // says elsewhere (most placements confirmed within 48 hours of assessment).
  {
    slug: "banana-island",
    name: "Banana Island",
    axis: "Island",
    intro:
      "Discreet nursing, eldercare and live-in caregivers for Banana Island households, from the first assessment to round-the-clock cover.",
    landmarks: ["Banana Island residences", "Banana Island apartment towers", "Banana Island foreshore homes", "Ikoyi Link Bridge side"],
    nearbyHospitals: ["Lagoon Hospitals Ikoyi", "Reddington Hospital", "St. Nicholas Hospital", "First Cardiology"],
    commonNeeds: [
      {
        title: "Live-in care for an ageing parent",
        description:
          "A vetted live-in caregiver who fits the household's routine, with nursing visits added when health needs change.",
      },
      {
        title: "Nursing after a hospital stay",
        description: "Wound care, medicines on time and daily checks for the weeks after discharge, so recovery happens at home.",
      },
      {
        title: "Care run from abroad",
        description:
          "Many Banana Island homes are managed by family overseas. We bill them directly and send a WhatsApp note after every visit.",
      },
    ],
    responseLine: "Most placements are confirmed within 48 hours of the home assessment.",
    faqs: [
      {
        q: "Can your staff work within the estate's security procedures?",
        a: "Yes. We share each professional's details in advance so the household and estate security can clear them before the first visit.",
      },
      {
        q: "Do you offer live-in caregivers on Banana Island?",
        a: "Yes. Live-in, overnight and visiting arrangements are all available, agreed in the care plan after the assessment.",
      },
    ],
    nearby: ["ikoyi", "parkview", "osborne-foreshore"],
  },
  {
    slug: "parkview",
    name: "Parkview Estate",
    axis: "Island",
    intro:
      "Vetted nurses and caregivers for families in Parkview Estate, Ikoyi: eldercare, recovery after surgery and support for new mothers.",
    landmarks: ["Parkview Estate homes", "Parkview Estate apartments", "Gerrard Road side", "Ikoyi Club side"],
    nearbyHospitals: ["Lagoon Hospitals Ikoyi", "Reddington Hospital", "St. Nicholas Hospital", "First Cardiology"],
    commonNeeds: [
      {
        title: "Eldercare that keeps them at home",
        description: "Companion care, personal care and medication support for older relatives who want to stay in the home they know.",
      },
      {
        title: "Postnatal care and Omugwo",
        description: "Day or overnight support so a new mother can rest and heal, alongside family rather than instead of them.",
      },
      {
        title: "Recovery after surgery",
        description: "Skilled nursing for wounds, drains and medicines in the weeks after discharge.",
      },
    ],
    responseLine: "Most placements are confirmed within 48 hours of the home assessment.",
    faqs: [
      { q: "Do you cover all of Parkview Estate?", a: "Yes. We cover homes and apartments across Parkview, and the rest of Ikoyi." },
      { q: "Can we meet the carer before they start?", a: "Yes. We introduce the matched carer first, so you can confirm the fit." },
    ],
    nearby: ["ikoyi", "banana-island", "osborne-foreshore"],
  },
  {
    slug: "osborne-foreshore",
    name: "Osborne Foreshore",
    axis: "Island",
    intro: "Home nursing, eldercare and live-in caregivers for families in Osborne Foreshore Estate, Phases 1 and 2.",
    landmarks: ["Osborne Foreshore Estate Phase 1", "Osborne Foreshore Estate Phase 2", "Osborne Road side", "Ikoyi waterfront towers"],
    nearbyHospitals: ["Lagoon Hospitals Ikoyi", "Reddington Hospital", "St. Nicholas Hospital", "First Cardiology"],
    commonNeeds: [
      {
        title: "Care for an older parent",
        description: "Visiting or live-in carers for personal care, mobility and company, with a note to family after every visit.",
      },
      {
        title: "Chronic condition support",
        description: "Nursing visits for blood pressure, diabetes and medicines, with readings recorded each time.",
      },
      { title: "Nanny and childcare", description: "Vetted nannies matched to your family, live-in or live-out." },
    ],
    responseLine: "Most placements are confirmed within 48 hours of the home assessment.",
    faqs: [
      {
        q: "Do you cover both phases of Osborne Foreshore?",
        a: "Yes. We cover Phase 1, Phase 2 and the apartment towers along the waterfront.",
      },
      {
        q: "Can family abroad arrange and pay for care?",
        a: "Yes. We bill the family abroad directly and send a WhatsApp note after every visit.",
      },
    ],
    nearby: ["ikoyi", "banana-island", "parkview"],
  },
  {
    slug: "eko-atlantic",
    name: "Eko Atlantic",
    axis: "Island",
    intro: "Nurses, caregivers and nannies for residents of Eko Atlantic City, with care planned around busy households.",
    landmarks: ["Eko Atlantic City residences", "Eko Pearl Towers", "Azuri Peninsula", "Victoria Island side"],
    nearbyHospitals: ["Reddington Hospital VI", "Lagoon Hospitals VI", "St. Nicholas Hospital (nearby)"],
    commonNeeds: [
      { title: "Nanny and childcare", description: "Vetted nannies for working families, day or live-in, matched to your routine." },
      { title: "Postnatal support", description: "Day or overnight care for a new mother and baby, so the household can rest." },
      { title: "Nursing at home", description: "Medicines, injections, wound care and checks, without a trip across the city." },
    ],
    responseLine: "Most placements are confirmed within 48 hours of the home assessment.",
    faqs: [
      { q: "Do you cover apartments in Eko Atlantic?", a: "Yes. We cover the residential towers and homes across Eko Atlantic City." },
      {
        q: "Can care fit around our working hours?",
        a: "Yes. Visits, day cover, nights and live-in arrangements are agreed in the care plan.",
      },
    ],
    nearby: ["victoria-island", "ikoyi"],
  },
  {
    slug: "lekki-phase-1",
    name: "Lekki Phase 1",
    axis: "Island",
    intro: "Postnatal nurses, nannies and home nursing for families across Lekki Phase 1, from Admiralty Way to Fola Osibo.",
    landmarks: ["Admiralty Way", "Fola Osibo", "Bisola Durosinmi-Etti Drive", "Freedom Way", "Oniru side"],
    nearbyHospitals: ["Reddington Lekki", "Euracare Multi-Specialist Hospital", "Mart-Life Medical Centre"],
    commonNeeds: [
      { title: "Postnatal care and Omugwo", description: "Trained postnatal support for families without grandparents nearby, day or night." },
      { title: "Nannies for working parents", description: "Vetted, CPR-trained nannies, live-in or live-out, matched to your family." },
      { title: "Children's nursing", description: "Nursing at home for sick children and babies home from hospital." },
    ],
    responseLine: "Most placements are confirmed within 48 hours of the home assessment.",
    faqs: [
      {
        q: "Do you place live-in nannies in Lekki Phase 1?",
        a: "Yes. Every nanny is police-cleared, reference-checked and CPR certified before placement.",
      },
      {
        q: "Can a postnatal nurse start when we come home from hospital?",
        a: "Yes. For planned births we can plan support to start the day you come home.",
      },
    ],
    nearby: ["lekki", "victoria-island", "vgc"],
  },
  {
    slug: "vgc",
    name: "VGC",
    axis: "Island",
    intro: "Nurses, caregivers and nannies for families inside Victoria Garden City, along the Lekki-Epe corridor.",
    landmarks: ["Victoria Garden City estate", "VGC residential avenues", "VGC lakeside homes", "Lekki-Epe Expressway side"],
    nearbyHospitals: ["Lagoon Hospitals Lekki", "Royal Albert Hospital", "St. Ives Specialist Hospital"],
    commonNeeds: [
      { title: "Eldercare for parents who live with you", description: "Companion and personal care for older relatives at home, visiting or live-in." },
      { title: "Nanny and school-run support", description: "Vetted nannies for school runs, homework and evenings." },
      { title: "Nursing at home", description: "Medicines, wound care and checks, so you avoid the drive into town." },
    ],
    responseLine: "Most placements are confirmed within 48 hours of the home assessment.",
    faqs: [
      {
        q: "Can your staff get through the VGC gates?",
        a: "Yes. We share each professional's details in advance so the household and estate security can clear them.",
      },
      { q: "Do you cover the whole of VGC?", a: "Yes, and the wider Ajah and Lekki-Epe corridor." },
    ],
    nearby: ["ajah", "lekki"],
  },
  {
    slug: "ikeja-gra",
    name: "Ikeja GRA",
    axis: "Mainland",
    intro:
      "Home nursing, eldercare and live-in caregivers for families in Ikeja GRA, close to LASUTH and the mainland's specialist hospitals.",
    landmarks: ["Isaac John Street", "Joel Ogunnaike Street", "Oduduwa Way", "Sobo Arobiodu Street", "Mobolaji Bank Anthony Way side"],
    nearbyHospitals: [
      "Lagos State University Teaching Hospital (LASUTH)",
      "Reddington Hospital Ikeja",
      "First Consultants Medical Centre",
      "Eko Hospital Ikeja",
    ],
    commonNeeds: [
      { title: "Eldercare at home", description: "Personal care, mobility support and company for older parents in the family home." },
      {
        title: "Recovery after a hospital stay",
        description: "Nursing for wounds, medicines and daily checks after discharge from LASUTH or a private hospital.",
      },
      {
        title: "Chronic condition support",
        description: "Regular visits for blood pressure, diabetes and medicines, with readings recorded each time.",
      },
    ],
    responseLine: "Most placements are confirmed within 48 hours of the home assessment.",
    faqs: [
      { q: "Do you cover all of Ikeja GRA?", a: "Yes, and the rest of Ikeja, including Allen, Opebi and Maryland." },
      {
        q: "Can you pick up care after discharge from LASUTH?",
        a: "Yes. With your consent we collect the discharge notes and medicines list and start the day you come home.",
      },
    ],
    nearby: ["ikeja", "magodo-gra"],
  },
  {
    slug: "magodo-gra",
    name: "Magodo GRA",
    axis: "Mainland",
    intro:
      "Nurses and caregivers for families across Magodo GRA Phase 1 and Phase 2, for parents, new mothers and recovery at home.",
    landmarks: ["Magodo GRA Phase 1 (Isheri)", "Magodo GRA Phase 2 (Shangisha)", "CMD Road side", "Ojodu side"],
    nearbyHospitals: [
      "Lagos State University Teaching Hospital (LASUTH)",
      "Reddington Hospital Ikeja",
      "First Consultants Medical Centre",
    ],
    commonNeeds: [
      { title: "Care for ageing parents", description: "Visiting or live-in caregivers for personal care, mobility and company." },
      { title: "Postnatal support", description: "Day or overnight care so a new mother can rest and recover." },
      { title: "Nursing at home", description: "Medicines, injections, wound care and checks without the traffic to the hospital." },
    ],
    responseLine: "Most placements are confirmed within 48 hours of the home assessment.",
    faqs: [
      { q: "Do you cover both Magodo phases?", a: "Yes. We cover Phase 1 (Isheri) and Phase 2 (Shangisha)." },
      {
        q: "Can your staff get through estate security?",
        a: "Yes. We share each professional's details in advance so the household and estate can clear them.",
      },
    ],
    nearby: ["ikeja-gra", "ikeja"],
  },
];

export function getNeighbourhood(slug: string): Neighbourhood | undefined {
  return NEIGHBOURHOODS.find((n) => n.slug === slug);
}
