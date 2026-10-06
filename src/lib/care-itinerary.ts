// The page itinerary: how a section's questions are laid out across screens.
//
// A family answering on a phone should meet a short, obvious screen, not a
// whole section at once. The rules are deterministic, so the same answers
// always produce the same screens in the same order:
//
//   * a question and the follow-ups it opens always travel together;
//   * a question that opens follow-ups gets a screen of its own;
//   * a large structured control gets a screen of its own;
//   * otherwise at most two independent questions share a screen;
//   * a hidden question never leaves an empty screen behind.
//
// Page keys are built from the section and the root question, never from an
// array index, so a branch opening or closing cannot strand anyone on the
// wrong screen.
import type { CareCondition, CareField, CareFieldType, CareResponses, CareSection } from "@/lib/care";
import { fieldVisible } from "@/lib/care";

/** Controls that fill a screen on their own. */
export const COMPLEX_FIELD_TYPES: CareFieldType[] = [
  "condition_list", "medicine_list", "allergy_list", "medicine_choice", "care_upload",
  "repeatable", "matrix", "weekly_pattern", "appointment_preference",
];

export const MAX_CLUSTERS_PER_PAGE = 2;

export interface QuestionCluster {
  /** The question the cluster hangs from. */
  rootId: string;
  /** The root, then every follow-up it opens, in definition order. */
  fields: CareField[];
  /** True when the root opens follow-ups, or holds a full-width control. */
  complex: boolean;
}

export type ItineraryPageKind = "welcome" | "cover" | "questions" | "review";

export interface ItineraryPage {
  key: string;
  kind: ItineraryPageKind;
  sectionId?: string;
  /** A smaller navigable part of a long clinical section. */
  presentationId?: string;
  title?: string;
  /** 1-based position of this section among the applicable ones. */
  sectionNumber?: number;
  sectionCount?: number;
  /** 1-based position of this screen within its section's question screens. */
  partNumber?: number;
  partCount?: number;
  fields: CareField[];
}

interface PresentationRule {
  id: string;
  title: string;
  /** The question this stop opens on. Several are named where a later
   * version of the definition renamed it; the first one present is used. */
  startsAt: string | string[];
}

/** Long source sections are presented as shorter, clinically coherent stops. */
export const PRESENTATION_GROUPS: Record<string, PresentationRule[]> = {
  core_health: [
    { id: "conditions", title: "Health conditions", startsAt: "diagnosed_conditions" },
    { id: "hospital", title: "Recent hospital care", startsAt: "hospital_recent" },
    { id: "professionals", title: "Health professionals", startsAt: "professional_involved" },
    { id: "medicines", title: "Medicines and allergies", startsAt: "regular_medicines" },
  ],
  core_support: [
    { id: "current", title: "Support in place", startsAt: "support_now" },
    { id: "contact", title: "Staying in touch", startsAt: ["enquirer_location", "alt_contact_has", "alt_contact_first_name"] },
  ],
  core_arrangements: [
    { id: "care", title: "Care arrangements", startsAt: "care_days" },
    { id: "assessment", title: "Assessment availability", startsAt: "visit_preferences" },
  ],
  svc_nanny_children: [
    { id: "childcare", title: "The childcare needed", startsAt: "nn_care_kind" },
    { id: "setting", title: "Nursery or school", startsAt: "nn_setting_attends" },
    { id: "health", title: "Health and medicines", startsAt: "nn_health" },
    { id: "meals", title: "Meals", startsAt: ["nn_diet_has", "nn_diet"] },
    { id: "sleep", title: "Sleep", startsAt: "nn_naps" },
    { id: "day", title: "Day to day", startsAt: "nn_toileting" },
    { id: "safety", title: "Safety and supervision", startsAt: "nn_safety_areas" },
  ],
};

interface PresentationPart {
  id: string;
  title: string;
  fields: CareField[];
}

export const presentationParts = (section: CareSection): PresentationPart[] => {
  const rules = PRESENTATION_GROUPS[section.id];
  if (!rules) return [{ id: section.id, title: section.title, fields: section.fields }];
  // A stop whose first question a version no longer has is left out; its
  // questions join the stop before. A version that has none of them is shown
  // as one stop.
  const found = rules
    .map((rule) => {
      const names = Array.isArray(rule.startsAt) ? rule.startsAt : [rule.startsAt];
      for (const name of names) {
        const at = section.fields.findIndex((field) => field.id === name);
        if (at >= 0) return { rule, at };
      }
      return null;
    })
    .filter((entry): entry is { rule: PresentationRule; at: number } => entry !== null)
    .sort((a, b) => a.at - b.at);
  if (found.length === 0) return [{ id: section.id, title: section.title, fields: section.fields }];
  return found.map(({ rule, at }, index) => ({
    id: rule.id,
    title: rule.title,
    fields: section.fields.slice(index === 0 ? 0 : at, found[index + 1]?.at ?? section.fields.length),
  }));
};

/** Every question a condition reads. */
const conditionFields = (condition: CareCondition | undefined, into: Set<string>): void => {
  if (!condition || typeof condition !== "object") return;
  const record = condition as Record<string, unknown>;
  if (typeof record.field === "string") into.add(record.field);
  for (const key of ["allOf", "anyOf"] as const) {
    const list = record[key];
    if (Array.isArray(list)) for (const inner of list) conditionFields(inner as CareCondition, into);
  }
  if (record.not) conditionFields(record.not as CareCondition, into);
};

/**
 * The visible questions of one section, gathered into clusters. A question
 * belongs to the cluster of the nearest earlier question its condition reads.
 */
export const clustersForSection = (
  section: CareSection,
  responses: CareResponses,
): QuestionCluster[] => {
  const visible = (section.fields ?? []).filter((field) => fieldVisible(field, responses));
  const clusters: QuestionCluster[] = [];
  const owner = new Map<string, QuestionCluster>();

  for (const field of visible) {
    const reads = new Set<string>();
    conditionFields(field.showWhen, reads);

    // The last cluster that already holds a question this one depends on.
    let parent: QuestionCluster | undefined;
    for (const id of reads) {
      const found = owner.get(id);
      if (found) parent = found;
    }

    if (parent) {
      parent.fields.push(field);
      parent.complex = true;
      owner.set(field.id, parent);
      continue;
    }

    const cluster: QuestionCluster = {
      rootId: field.id,
      fields: [field],
      complex: COMPLEX_FIELD_TYPES.includes(field.type),
    };
    clusters.push(cluster);
    owner.set(field.id, cluster);
  }

  // A cluster holding any full-width control is a screen of its own.
  for (const cluster of clusters) {
    if (cluster.fields.some((f) => COMPLEX_FIELD_TYPES.includes(f.type))) cluster.complex = true;
  }
  return clusters;
};

/** The question screens of one section, in order. */
export const pagesForSection = (
  section: CareSection,
  responses: CareResponses,
): Array<{ key: string; fields: CareField[] }> => {
  const clusters = clustersForSection(section, responses);
  const pages: Array<{ key: string; fields: CareField[] }> = [];
  let simple: QuestionCluster[] = [];

  const flush = () => {
    if (simple.length === 0) return;
    pages.push({
      key: `${section.id}#${simple[0].rootId}`,
      fields: simple.flatMap((c) => c.fields),
    });
    simple = [];
  };

  for (const cluster of clusters) {
    if (cluster.complex) {
      flush();
      pages.push({ key: `${section.id}#${cluster.rootId}`, fields: cluster.fields });
      continue;
    }
    simple.push(cluster);
    if (simple.length === MAX_CLUSTERS_PER_PAGE) flush();
  }
  flush();
  return pages;
};

/**
 * The whole journey: welcome, then a cover and its screens for each applicable
 * section, then the review. A section with nothing visible left contributes
 * nothing at all.
 */
export const buildItinerary = (
  sections: CareSection[],
  responses: CareResponses,
): ItineraryPage[] => {
  const pages: ItineraryPage[] = [
    { key: "welcome", kind: "welcome", fields: [] },
  ];

  const live = sections.flatMap((section) =>
    presentationParts(section).map((presentation) => ({
      section,
      presentation,
      parts: pagesForSection({ ...section, fields: presentation.fields }, responses),
    })),
  ).filter((entry) => entry.parts.length > 0);

  live.forEach(({ section, presentation, parts }, index) => {
    const sectionNumber = index + 1;
    pages.push({
      key: `${section.id}:${presentation.id}:cover`,
      kind: "cover",
      sectionId: section.id,
      presentationId: presentation.id,
      title: presentation.title,
      sectionNumber,
      sectionCount: live.length,
      fields: [],
    });
    parts.forEach((part, partIndex) => {
      pages.push({
        key: part.key,
        kind: "questions",
        sectionId: section.id,
        presentationId: presentation.id,
        title: presentation.title,
        sectionNumber,
        sectionCount: live.length,
        partNumber: partIndex + 1,
        partCount: parts.length,
        fields: part.fields,
      });
    });
  });

  pages.push({ key: "review", kind: "review", fields: [] });
  return pages;
};

/**
 * Where to land after the itinerary has changed shape. The saved key first,
 * then the section's cover, then the nearest page that still exists.
 */
export const resolvePosition = (
  pages: ItineraryPage[],
  saved: { key?: string | null; sectionId?: string | null } | null,
): number => {
  if (!saved) return 0;
  if (saved.key) {
    const exact = pages.findIndex((p) => p.key === saved.key);
    if (exact >= 0) return exact;
  }
  if (saved.sectionId) {
    const inSection = pages.findIndex((p) => p.sectionId === saved.sectionId);
    if (inSection >= 0) return inSection;
  }
  return 0;
};
