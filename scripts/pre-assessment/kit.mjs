// Small helpers for writing the pre-assessment definition.
//
// The definition is data. These helpers only save repetition: they add no
// behaviour of their own, and everything they produce is validated before it
// can be published.

/** "value|Label" or "value|Label|x" for an option that clears the others. */
export const opts = (list) =>
  list.map((entry) => {
    const [value, label, exclusive] = entry.split("|");
    return exclusive ? { value, label, exclusive: true } : { value, label };
  });

export const q = (id, record, asked, type, extra = {}) => ({ id, record, asked, type, ...extra });

/** Yes / No, always as buttons. */
export const yesNo = (id, record, asked, extra = {}) =>
  q(id, record, asked, "choice", { options: opts(["yes|Yes", "no|No"]), ...extra });

/** Yes / No / Not sure. */
export const yesNoUnsure = (id, record, asked, extra = {}) =>
  q(id, record, asked, "choice", {
    options: opts(["yes|Yes", "no|No", "not_sure|Not sure"]),
    ...extra,
  });

export const when = (field, values) => ({ field, in: values });
export const all = (...conditions) => ({ allOf: conditions });
export const any = (...conditions) => ({ anyOf: conditions });
export const not = (condition) => ({ not: condition });

export const section = (id, title, whenRule, fields, extra = {}) => ({
  id,
  title,
  when: whenRule,
  fields,
  ...extra,
});

/** Routing facts, so a condition reads the same name everywhere. */
export const SELF = { field: "derived_is_self", in: ["yes"] };
export const OTHER = { field: "derived_is_self", in: ["no"] };
export const isGroup = (...groups) => ({ field: "derived_recipient_group", in: groups });
export const isService = (...services) => ({ field: "derived_service", in: services });
export const CHILD_RECIPIENT = isGroup("child", "baby");
export const ADULT_RECIPIENT = isGroup("adult", "older_person", "maternal");
