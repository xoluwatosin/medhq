// The pre-assessment's chapters.
//
// The form definition holds many sections, and long ones are split again into
// smaller stops. Shown one by one, that was thirteen numbered covers for a
// single person. A family thinks in a few plain chapters instead: who the
// person is, their health, their day, who is around them, then when and where.
// Every section belongs to exactly one chapter, and the chapters always run in
// this order, so the questions about a person come before the practical ones
// about the visit. Consent is not a chapter: it is asked on the page where the
// answers are sent.

export type ChapterKey = "about" | "health" | "daily" | "support" | "when";

export const CHAPTER_ORDER: ChapterKey[] = ["about", "health", "daily", "support", "when"];

const HEALTH = new Set([
  "core_health", "svc_clinical", "svc_antenatal", "svc_postnatal_mother", "svc_postnatal_baby",
  "svc_post_surgical", "mod_wound", "mod_device", "mod_respiratory", "mod_nutrition", "mod_palliative",
]);

const DAILY = new Set([
  "svc_eldercare", "mod_mobility", "svc_nanny_children", "svc_nanny_role", "svc_additional_needs",
]);

/** The chapter a section is asked in, or null for consent, which is asked on sending. */
export const chapterOf = (sectionId: string): ChapterKey | null => {
  if (sectionId === "consent") return null;
  if (sectionId === "core_arrangements") return "when";
  if (sectionId === "core_support") return "support";
  if (HEALTH.has(sectionId)) return "health";
  if (DAILY.has(sectionId) || sectionId.startsWith("svc_nanny")) return "daily";
  return "about";
};

/** Sorts sections into chapter order, keeping the definition's order within a chapter. */
export const inChapterOrder = <T extends { id: string }>(sections: T[]): T[] =>
  sections
    .map((section, index) => ({ section, index, rank: CHAPTER_ORDER.indexOf(chapterOf(section.id) ?? "when") }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ section }) => section);

/**
 * The chapter's name. `name` is the person's first name, or null when the
 * person answering is the one receiving care.
 */
export const chapterTitle = (chapter: ChapterKey, name: string | null): string => {
  const own = name ? `${name}’s` : "Your";
  switch (chapter) {
    case "about": return name ? `About ${name}` : "About you";
    case "health": return `${own} health`;
    case "daily": return `${own} day to day`;
    case "support": return "Support and contacts";
    case "when": return "When and where";
  }
};

/** One line under the chapter's name: what it covers. */
export const chapterLine = (chapter: ChapterKey, name: string | null): string => {
  const them = name ?? "you";
  switch (chapter) {
    case "about": return `What is happening, and how ${them} would like to be spoken to.`;
    case "health": return "Conditions, hospital care, medicines and allergies.";
    case "daily": return name ? `How ${name} manages each day, and what help would make a difference.` : "How you manage each day, and what help would make a difference.";
    case "support": return "Who helps now, and who we can contact.";
    case "when": return "The care you have in mind, when it should start, and where we visit.";
  }
};

/** Rough minutes to answer a number of questions: about twenty seconds each, never under two. */
export const minutesFor = (questions: number): number => Math.max(2, Math.ceil((questions * 20) / 60));
