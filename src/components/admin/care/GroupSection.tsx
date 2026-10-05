// Family and care group: the people, the recipients, the relationships between
// them, the services intended for each recipient, and the one visit that can
// cover several of them. Membership and relationship grant no access.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cxInputClass } from "@/components/candidate/primitives";
import { MuEmpty, MuRow, MuSection, MuTable } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { CareField as CareFormRow, CareSheet } from "@/components/admin/care/CareSurface";
import { DateField, DateTimeField, SelectField, Status } from "@/components/field";
import { careErrorMessage } from "@/lib/care-errors";
import { roleText } from "@/lib/care-records";
import { assessorOptions, LOCATION_KINDS, locationLabel, type AssessorOption } from "@/lib/care-assessment";
import { formatDateTime } from "@/lib/format";
import {
  addRecipient, CareGroupOverview, CoverageRecipient, groupForClient, groupOverview, readinessSentences,
  relationshipTerms, removeRelationship, removeServiceIntention, RequestCoverage, RequestReadiness,
  requestCoverage, requestReadiness, saveRequest, saveVisit, selectRequest, sendTopUp,
  serviceOptions, setRelationship, setServiceIntention,
} from "@/lib/care-group";

const STATE_LABELS: Record<string, string> = {
  proposed: "Proposed",
  confirmed: "Confirmed",
  declined: "Declined",
};

const GroupSection = ({
  clientId, canEdit, onChanged,
}: {
  clientId: string;
  canEdit: boolean;
  onChanged?: () => void;
}) => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<CareGroupOverview | null>(null);
  const [readiness, setReadiness] = useState<RequestReadiness | null>(null);
  const [coverage, setCoverage] = useState<RequestCoverage | null>(null);
  const [services, setServices] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [terms, setTerms] = useState<{ code: string; label: string; requires_text: boolean }[]>([]);
  const [assessors, setAssessors] = useState<AssessorOption[]>([]);

  // Adding a recipient
  const [addingRecipient, setAddingRecipient] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientDob, setRecipientDob] = useState("");

  // Recording a relationship
  const [addingRelationship, setAddingRelationship] = useState(false);
  const [fromPerson, setFromPerson] = useState("");
  const [toPerson, setToPerson] = useState("");
  const [relationshipCode, setRelationshipCode] = useState("");
  const [otherLabel, setOtherLabel] = useState("");

  // Recording a service
  const [editingService, setEditingService] = useState<string | null>(null);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [serviceState, setServiceState] = useState("proposed");
  const [serviceRecipients, setServiceRecipients] = useState<string[]>([]);
  const [serviceReason, setServiceReason] = useState("");

  // The visit
  const [visitOpen, setVisitOpen] = useState(false);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [visitWhen, setVisitWhen] = useState("");
  const [visitLocation, setVisitLocation] = useState("home");
  const [visitAssessor, setVisitAssessor] = useState("");

  const [saving, setSaving] = useState(false);
  const [sendingTopUp, setSendingTopUp] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get("request");

  const request = useMemo(
    () => selectRequest(overview?.requests ?? [], requestedId),
    [overview, requestedId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const groupId = await groupForClient(clientId);
      const data = await groupOverview(groupId);
      setOverview(data);
      const selected = selectRequest(data.requests, requestedId);
      setReadiness(selected ? await requestReadiness(selected.id) : null);
      setCoverage(selected ? await requestCoverage(selected.id) : null);
    } catch (error) {
      toast.error(careErrorMessage(error, "Could not load the family"));
    } finally {
      setLoading(false);
    }
  }, [clientId, requestedId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const [s, t, a] = await Promise.all([serviceOptions(), relationshipTerms(), assessorOptions()]);
        setServices(s);
        setTerms(t);
        setAssessors(a);
      } catch (error) {
        toast.error(careErrorMessage(error, "Could not load the Care options"));
      }
    })();
  }, []);

  const peopleOptions = useMemo(
    () => (overview?.members ?? []).map((m) => ({ value: m.person_id, label: m.full_name })),
    [overview],
  );
  const personName = useCallback(
    (id: string | null) => (overview?.members ?? []).find((m) => m.person_id === id)?.full_name ?? null,
    [overview],
  );

  const refresh = async () => { await load(); onChanged?.(); };

  const submitRecipient = async () => {
    if (!request) return;
    setSaving(true);
    try {
      await addRecipient({ requestId: request.id, fullName: recipientName, dateOfBirth: recipientDob || null });
      toast.success("Recipient added");
      setAddingRecipient(false);
      setRecipientName("");
      setRecipientDob("");
      await refresh();
    } catch (error) {
      toast.error(careErrorMessage(error, "Could not add the recipient"));
    } finally {
      setSaving(false);
    }
  };

  const submitRelationship = async () => {
    if (!overview) return;
    setSaving(true);
    try {
      await setRelationship({
        groupId: overview.group.id,
        fromPersonId: fromPerson,
        toPersonId: toPerson,
        code: relationshipCode,
        otherLabel: otherLabel || null,
      });
      toast.success("Relationship recorded");
      setAddingRelationship(false);
      setOtherLabel("");
      await refresh();
    } catch (error) {
      toast.error(careErrorMessage(error, "Could not record the relationship"));
    } finally {
      setSaving(false);
    }
  };

  const openService = (id: string | null) => {
    const existing = request?.services.find((s) => s.id === id) ?? null;
    setEditingService(id);
    setServiceId(existing?.service_id ?? "");
    setServiceState(existing?.state ?? "proposed");
    setServiceRecipients(existing ? existing.recipients.map((r) => r.request_recipient_id) : []);
    setServiceReason(existing?.reason ?? "");
    setServiceOpen(true);
  };

  const submitService = async () => {
    if (!request) return;
    setSaving(true);
    try {
      await setServiceIntention({
        intentionId: editingService,
        requestId: request.id,
        serviceId,
        recipientIds: serviceRecipients,
        state: serviceState,
        reason: serviceReason || null,
      });
      toast.success("Service saved");
      setServiceOpen(false);
      await refresh();
    } catch (error) {
      toast.error(careErrorMessage(error, "Could not save the service"));
    } finally {
      setSaving(false);
    }
  };

  // A service recorded after the family answered is asked about in a short
  // top-up, never by sending the whole pre-assessment again.
  const sendTopUpFor = async (recipient: CoverageRecipient) => {
    setSendingTopUp(recipient.request_recipient_id);
    try {
      const result = await sendTopUp({
        clientId: recipient.client_id,
        requestRecipientId: recipient.request_recipient_id,
        intentionIds: recipient.gaps.map((g) => g.intention_id),
      });
      if (result.emailed) toast.success("Top-up questions sent");
      else toast.message(result.emailError ?? "Link ready", { description: result.link });
      await refresh();
    } catch (error) {
      toast.error(careErrorMessage(error, "Could not send the top-up questions"));
    } finally {
      setSendingTopUp(null);
    }
  };

  const openVisit = () => {
    const visit = overview?.visits[0] ?? null;
    setVisitId(visit?.id ?? null);
    setVisitWhen(visit?.appointment_at ?? "");
    setVisitLocation(visit?.location_kind ?? "home");
    setVisitAssessor(visit?.assessor_person_id ?? "");
    setVisitOpen(true);
  };

  const submitVisit = async () => {
    if (!overview) return;
    setSaving(true);
    try {
      await saveVisit({
        visitId,
        groupId: overview.group.id,
        requestId: request?.id ?? null,
        appointmentAt: visitWhen || null,
        locationKind: visitLocation,
        assessorPersonId: visitAssessor || null,
      });
      toast.success("Assessment visit saved");
      setVisitOpen(false);
      await refresh();
    } catch (error) {
      toast.error(careErrorMessage(error, "Could not save the assessment visit"));
    } finally {
      setSaving(false);
    }
  };

  const markOpen = async () => {
    if (!overview || !request) return;
    try {
      await saveRequest({ requestId: request.id, groupId: overview.group.id, status: "open" });
      await refresh();
    } catch (error) {
      toast.error(careErrorMessage(error, "Could not update the request"));
    }
  };

  if (loading) return <p className="py-10 text-center text-sm text-muted-foreground">Loading the family</p>;
  if (!overview) {
    return (
      <MuSection title="Family">
        <MuEmpty art={art.objHandsHeart} title="No family recorded" description="The family appears here once a care request links people to this client." />
      </MuSection>
    );
  }

  const outstanding = readiness ? readinessSentences(readiness) : [];
  const recipients = request?.recipients ?? [];
  const visit = overview.visits[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <MuSection
        title="Request"
        description="The enquiry this family came from."
        actions={
          canEdit && request?.status === "draft" ? (
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={markOpen}>
              Mark as open
            </Button>
          ) : undefined
        }
      >
        <MuTable
          rows={[
            { label: "Family", value: overview.group.display_name },
            { label: "Status", value: request ? request.status.replace(/_/g, " ") : null },
            { label: "Source", value: request?.source ?? null },
            { label: "Enquirer", value: personName(request?.enquirer_person_id ?? null) },
          ]}
        />
      </MuSection>

      <MuSection title="People">
        {overview.members.length === 0 ? (
          <MuEmpty icon={Users} title="No people recorded" />
        ) : (
          <div className="divide-y divide-line-soft">
            {overview.members.map((m) => (
              <MuRow
                key={m.id}
                title={m.full_name}
                state={[roleText(m.roles), m.email, m.phone].filter(Boolean).join(", ") || undefined}
              />
            ))}
          </div>
        )}
      </MuSection>

      <MuSection
        title="Recipients"
        description="Each keeps their own care record. Clinical information is never shared."
        actions={
          canEdit && request ? (
            <Button type="button" variant="secondary" size="sm" className="h-9" onClick={() => setAddingRecipient(true)}>
              Add recipient
            </Button>
          ) : undefined
        }
      >
        {recipients.length === 0 ? (
          <MuEmpty icon={Users} title="No recipients" />
        ) : (
          <div className="divide-y divide-line-soft">
            {recipients.map((r) => (
              <MuRow
                key={r.id}
                title={r.full_name}
                state={r.address_line ?? undefined}
                status={
                  r.person_id
                    ? <Status label="Person attached" tone="good" />
                    : <Status label="No person attached" tone="warning" />
                }
              />
            ))}
          </div>
        )}
      </MuSection>

      <MuSection
        title="Relationships"
        actions={
          canEdit ? (
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setAddingRelationship(true)}>
              Record relationship
            </Button>
          ) : undefined
        }
      >
        {overview.relationships.length === 0 ? (
          <MuEmpty icon={Users} title="No relationships recorded" />
        ) : (
          <div className="divide-y divide-line-soft">
            {overview.relationships.map((rel) => (
              <MuRow
                key={rel.id}
                title={`${personName(rel.from_person_id) ?? "Someone"}: ${
                  terms.find((t) => t.code === rel.relationship_code)?.label ?? rel.relationship_code
                } ${personName(rel.to_person_id) ?? "someone"}`}
                state={rel.other_label ?? undefined}
                action={
                  canEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9"
                      onClick={async () => {
                        try {
                          await removeRelationship(rel.id);
                          await refresh();
                        } catch (error) {
                          toast.error(careErrorMessage(error, "Could not remove the relationship"));
                        }
                      }}
                    >
                      Remove
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
      </MuSection>

      <MuSection
        title="Services"
        description="A service can be shared by several recipients or belong to one of them."
        actions={
          canEdit && request ? (
            <Button type="button" variant="secondary" size="sm" className="h-9" onClick={() => openService(null)}>
              Add service
            </Button>
          ) : undefined
        }
      >
        {(coverage?.recipients ?? [])
          .filter((r) => r.gaps.length > 0)
          .map((r) => (
            <div
              key={r.request_recipient_id}
              className="mb-3 flex flex-col gap-3 border border-l-4 border-line border-l-brand bg-tint/45 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-ink">
                  Not covered by the pre-assessment yet
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {r.name}: {r.gaps.map((g) => g.service_name).join(", ")}.
                  {r.gaps.every((g) => g.top_up_sent) ? " Top-up questions have been sent." : ""}
                </p>
              </div>
              {canEdit && !coverage?.visit_started && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 shrink-0"
                  disabled={sendingTopUp === r.request_recipient_id}
                  onClick={() => void sendTopUpFor(r)}
                >
                  {r.gaps.every((g) => g.top_up_sent) ? "Send top-up questions again" : "Send top-up questions"}
                </Button>
              )}
            </div>
          ))}
        {(request?.services ?? []).length === 0 ? (
          <MuEmpty icon={Users} title="No services recorded" />
        ) : (
          <div className="divide-y divide-line-soft">
            {(request?.services ?? []).map((s) => {
              const names = s.recipients
                .map((sr) => recipients.find((r) => r.id === sr.request_recipient_id)?.full_name)
                .filter(Boolean)
                .join(", ");
              const conflict = s.recipients.some((sr) => sr.needs_clinical_resolution);
              return (
                <MuRow
                  key={s.id}
                  title={s.service_name}
                  state={names || undefined}
                  status={
                    <>
                      <Status label={STATE_LABELS[s.state] ?? s.state} tone={s.state === "confirmed" ? "good" : "neutral"} />
                      {conflict && <Status label="Clinical decision needed" tone="warning" />}
                    </>
                  }
                  action={
                    canEdit ? (
                      <>
                        <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => openService(s.id)}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9"
                          onClick={async () => {
                            try {
                              await removeServiceIntention(s.id);
                              await refresh();
                            } catch (error) {
                              toast.error(careErrorMessage(error, "Could not remove the service"));
                            }
                          }}
                        >
                          Remove
                        </Button>
                      </>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </MuSection>

      <MuSection
        title="Assessment visit"
        description="One visit can cover several recipients."
        actions={
          canEdit ? (
            <Button type="button" variant="secondary" size="sm" className="h-9" onClick={openVisit}>
              {visit ? "Edit visit" : "Arrange visit"}
            </Button>
          ) : undefined
        }
      >
        {!visit ? (
          <MuEmpty icon={Users} title="No assessment visit arranged" />
        ) : (
          <MuTable
            rows={[
              { label: "When", value: visit.appointment_at ? formatDateTime(visit.appointment_at) : null },
              { label: "Where", value: locationLabel(visit.location_kind) },
              { label: "Status", value: visit.status },
              {
                label: "Recipients covered",
                value: visit.work_ids.length
                  ? `${visit.work_ids.length} assessment${visit.work_ids.length === 1 ? "" : "s"} attached`
                  : null,
              },
            ]}
          />
        )}
      </MuSection>

      <MuSection title="Questionnaire" description="What still has to be true before the questions go out.">
        {outstanding.length === 0 ? (
          <p className="px-5 py-4 text-[14.5px] text-muted-foreground">
            Everything needed is in place.
          </p>
        ) : (
          <ul className="flex list-disc flex-col gap-1 px-9 py-4 text-[14.5px] text-muted-foreground">
            {outstanding.map((line) => <li key={line}>{line}</li>)}
          </ul>
        )}
      </MuSection>

      <CareSheet
        open={addingRecipient}
        onOpenChange={setAddingRecipient}
        title="Add recipient"
        description="A new care record is created for this person."
        onSave={submitRecipient}
        saving={saving}
        saveDisabled={!recipientName.trim()}
      >
        <CareFormRow label="Full name">
          <input className={cxInputClass()} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
        </CareFormRow>
        <CareFormRow label="Date of birth">
          <DateField value={recipientDob} onChange={setRecipientDob} />
        </CareFormRow>
      </CareSheet>

      <CareSheet
        open={addingRelationship}
        onOpenChange={setAddingRelationship}
        title="Record relationship"
        description="This describes people. It grants no access."
        onSave={submitRelationship}
        saving={saving}
        saveDisabled={!fromPerson || !toPerson || !relationshipCode || fromPerson === toPerson}
      >
        <CareFormRow label="Person">
          <SelectField value={fromPerson} onChange={setFromPerson} options={peopleOptions} placeholder="Choose a person" />
        </CareFormRow>
        <CareFormRow label="Relationship">
          <SelectField
            value={relationshipCode}
            onChange={setRelationshipCode}
            options={terms.map((t) => ({ value: t.code, label: t.label }))}
            placeholder="Choose a relationship"
          />
        </CareFormRow>
        <CareFormRow label="Of">
          <SelectField value={toPerson} onChange={setToPerson} options={peopleOptions} placeholder="Choose a person" />
        </CareFormRow>
        {terms.find((t) => t.code === relationshipCode)?.requires_text && (
          <CareFormRow label="Say what the relationship is">
            <input className={cxInputClass()} value={otherLabel} onChange={(e) => setOtherLabel(e.target.value)} />
          </CareFormRow>
        )}
      </CareSheet>

      <CareSheet
        open={serviceOpen}
        onOpenChange={setServiceOpen}
        title={editingService ? "Edit service" : "Add service"}
        onSave={submitService}
        saving={saving}
        saveDisabled={!serviceId || serviceRecipients.length === 0}
      >
        <CareFormRow label="Service">
          <SelectField
            value={serviceId}
            onChange={setServiceId}
            options={services.map((s) => ({ value: s.id, label: s.name }))}
            placeholder="Choose a service"
          />
        </CareFormRow>
        <CareFormRow label="State">
          <SelectField
            value={serviceState}
            onChange={setServiceState}
            options={[
              { value: "proposed", label: "Proposed" },
              { value: "confirmed", label: "Confirmed" },
              { value: "declined", label: "Declined" },
            ]}
          />
        </CareFormRow>
        <CareFormRow label="Recipients">
          <div className="flex flex-col gap-2">
            {recipients.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-[14.5px]">
                <Checkbox
                  checked={serviceRecipients.includes(r.id)}
                  onCheckedChange={(checked) =>
                    setServiceRecipients((prev) =>
                      checked ? [...prev, r.id] : prev.filter((id) => id !== r.id),
                    )
                  }
                />
                {r.full_name}
              </label>
            ))}
          </div>
        </CareFormRow>
        <CareFormRow label="Reason">
          <input className={cxInputClass()} value={serviceReason} onChange={(e) => setServiceReason(e.target.value)} />
        </CareFormRow>
      </CareSheet>

      <CareSheet
        open={visitOpen}
        onOpenChange={setVisitOpen}
        title={visitId ? "Edit assessment visit" : "Arrange assessment visit"}
        onSave={submitVisit}
        saving={saving}
      >
        <CareFormRow label="When">
          <DateTimeField value={visitWhen} onChange={setVisitWhen} />
        </CareFormRow>
        <CareFormRow label="Where">
          <SelectField
            value={visitLocation}
            onChange={setVisitLocation}
            options={LOCATION_KINDS.map((k) => ({ value: k.value, label: k.label }))}
          />
        </CareFormRow>
        <CareFormRow label="Assessor">
          <SelectField
            value={visitAssessor}
            onChange={setVisitAssessor}
            options={assessors.map((a) => ({ value: a.person_id, label: a.full_name }))}
            placeholder="Choose an assessor"
          />
        </CareFormRow>
      </CareSheet>
    </div>
  );
};

export default GroupSection;
