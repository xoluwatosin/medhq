// Shared Resend tags so every email we send is identifiable in the event
// stream: which template it was, and which candidate it concerns. The
// resend-webhook function reads these tags and records events for any email
// carrying a `template` tag, not just campaigns.
export function emailTags(template: string, personId?: string | null): { name: string; value: string }[] {
  const tags = [{ name: "template", value: template }];
  if (personId) tags.push({ name: "person_id", value: String(personId) });
  return tags;
}
