// A small, entirely invented question set used to prove the engine.
//
// Nothing here is a Medic Connect clinical question. It exists so the rules
// can be tested without publishing clinical content, and it is never loaded by
// the application.
import type { CareDefinition } from "@/lib/care";

export const SYNTHETIC_DEFINITION: CareDefinition = {
  version: 1,
  kind: "synthetic",
  moduleRules: {
    medicines: {
      always: ["eldercare"],
      whenAny: [{ field: "syn.core.medicines_present", in: ["yes"] }],
    },
    devices: {
      whenAny: [{ field: "syn.core.devices", contains: ["oxygen"] }],
    },
  },
  sections: [
    {
      id: "syn_core",
      title: "Synthetic core",
      when: "always",
      fields: [
        {
          id: "syn.core.first_name",
          record: "First name",
          asked: "First name",
          type: "text",
          required: true,
        },
        {
          id: "syn.core.medicines_present",
          record: "Medicines in the home",
          asked: "Are any medicines taken at home?",
          type: "choice",
          required: true,
          options: [
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ],
        },
        {
          id: "syn.core.devices",
          record: "Equipment at home",
          asked: "What equipment is used at home?",
          type: "multi",
          options: [
            { value: "none", label: "None", exclusive: true },
            { value: "oxygen", label: "Oxygen" },
            { value: "hoist", label: "Hoist" },
          ],
        },
      ],
    },
    {
      id: "syn_clinical",
      title: "Synthetic clinical",
      when: "always",
      fields: [
        {
          id: "syn.clinical.account",
          record: "Assessor's account",
          asked: "Record what you found.",
          type: "long_text",
          assessorOnly: true,
          audience: "internal",
        },
        {
          id: "syn.clinical.baseline",
          record: "Baseline observations",
          asked: "Record the baseline observations.",
          type: "measurement",
          assessorOnly: true,
          audience: "restricted",
          measures: [
            { key: "temperature", label: "Temperature", unit: "°C" },
            { key: "pulse", label: "Pulse", unit: "bpm" },
          ],
        },
      ],
    },
    {
      id: "syn_medicines",
      title: "Synthetic medicines",
      when: { module: "medicines" },
      fields: [
        {
          id: "syn.medicines.list",
          record: "Medicines",
          asked: "List the medicines taken.",
          type: "repeatable",
          items: ["Name", "Dose", "Timing"],
        },
      ],
    },
    {
      id: "syn_devices",
      title: "Synthetic devices",
      when: { module: "devices" },
      fields: [
        {
          id: "syn.devices.checks",
          record: "Device checks",
          asked: "Record the device checks.",
          type: "yes_no",
        },
      ],
    },
  ],
};

export default SYNTHETIC_DEFINITION;
