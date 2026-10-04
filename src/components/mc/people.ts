import { art } from "./art";

// Vary the character from page to page; each stands on the bottom edge of a navy band.
const PEOPLE = [art.charGrandma, art.charCaregiver, art.charDoctor, art.charNurse];

/** The character the closing call-to-action band shows on a path. */
export const personFor = (path: string) => PEOPLE[[...path].reduce((n, c) => n + c.charCodeAt(0), 0) % PEOPLE.length];

/** The preferred character, unless the closing band on this path already shows them. */
export const otherPersonThan = (path: string, preferred: string) =>
  preferred !== personFor(path) ? preferred : PEOPLE.find((p) => p !== preferred && p !== personFor(path)) ?? preferred;
