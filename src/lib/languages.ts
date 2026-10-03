// Languages we offer as a picker. Nigerian languages first, because that is
// what most of our people speak, then the wider world. Nobody types free text
// where we can hold a list.

export const NIGERIAN_LANGUAGES = [
  "English", "Nigerian Pidgin", "Hausa", "Yoruba", "Igbo", "Fulfulde", "Kanuri",
  "Ibibio", "Efik", "Annang", "Tiv", "Ijaw", "Izon", "Urhobo", "Isoko", "Itsekiri",
  "Edo", "Esan", "Etsako", "Nupe", "Igala", "Idoma", "Ebira", "Gwari", "Berom",
  "Jukun", "Bura", "Margi", "Babur", "Mumuye", "Tarok", "Angas", "Bachama",
  "Chamba", "Eggon", "Ogoni", "Khana", "Ikwerre", "Ekpeye", "Ogba", "Kalabari",
  "Okrika", "Nembe", "Epie", "Degema", "Yala", "Bekwarra", "Bette", "Ejagham",
  "Boki", "Mbembe", "Igede", "Alago", "Migili", "Gade", "Koro", "Kambari",
  "Dukawa", "Zarma", "Bade", "Ngizim", "Karekare", "Bolewa", "Ngamo", "Tangale",
  "Waja", "Kamwe", "Higgi", "Kilba", "Marghi", "Yandang", "Vere", "Longuda",
  "Arabic (Shuwa)", "Sign Language (Nigerian)",
] as const;

export const WORLD_LANGUAGES = [
  "French", "Arabic", "Portuguese", "Spanish", "German", "Italian", "Dutch",
  "Russian", "Ukrainian", "Polish", "Romanian", "Greek", "Turkish", "Hebrew",
  "Persian", "Urdu", "Hindi", "Punjabi", "Bengali", "Tamil", "Telugu",
  "Malayalam", "Gujarati", "Marathi", "Nepali", "Sinhala", "Mandarin Chinese",
  "Cantonese", "Japanese", "Korean", "Vietnamese", "Thai", "Khmer", "Malay",
  "Indonesian", "Tagalog", "Swahili", "Amharic", "Tigrinya", "Somali", "Oromo",
  "Zulu", "Xhosa", "Afrikaans", "Shona", "Chichewa", "Kinyarwanda", "Luganda",
  "Wolof", "Bambara", "Twi", "Ga", "Ewe", "Fante", "Mossi", "Lingala", "Kikongo",
  "Berber (Tamazight)", "Swedish", "Norwegian", "Danish", "Finnish", "Czech",
  "Slovak", "Hungarian", "Bulgarian", "Serbian", "Croatian", "Bosnian",
  "Albanian", "Lithuanian", "Latvian", "Estonian", "Georgian", "Armenian",
  "Azerbaijani", "Kazakh", "Uzbek", "Pashto", "British Sign Language",
] as const;

export const ALL_LANGUAGES: string[] = Array.from(
  new Set<string>([...NIGERIAN_LANGUAGES, ...WORLD_LANGUAGES]),
);

/** Suggestions as somebody types, Nigerian languages kept at the top. */
export const searchLanguages = (query: string, chosen: string[] = [], limit = 8): string[] => {
  const q = query.trim().toLowerCase();
  const taken = new Set(chosen.map((c) => c.toLowerCase()));
  const pool = ALL_LANGUAGES.filter((l) => !taken.has(l.toLowerCase()));
  if (!q) return pool.slice(0, limit);
  const starts = pool.filter((l) => l.toLowerCase().startsWith(q));
  const contains = pool.filter((l) => !l.toLowerCase().startsWith(q) && l.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, limit);
};
