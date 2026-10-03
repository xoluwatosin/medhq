// The version 10 pre-assessment: the nanny route asks each fact once.
// Version 9 stays as published, and every document written against it is
// rendered against its own definition.
import { describe, expect, it } from "vitest";
import definition from "../../docs/care/pre-assessment-v10.json";
import { fieldVisible, type CareField, type CareSection } from "@/lib/care";

const sections = (definition as unknown as { sections: CareSection[] }).sections;
const section = (id: string) => sections.find((s) => s.id === id)!;
const field = (sectionId: string, fieldId: string) =>
  section(sectionId).fields.find((f) => f.id === fieldId)! as CareField;
const values = (sectionId: string, fieldId: string) =>
  field(sectionId, fieldId).options?.map((o) => o.value) ?? [];

const visible = (f: CareField, answers: Record<string, unknown>) =>
  fieldVisible(f, answers as never);

describe("pre-assessment version 10: the school run", () => {
  const attends = () => field("svc_nanny_children", "nn_setting_attends");
  const settingName = () => field("svc_nanny_children", "nn_setting_name");
  const collection = () => field("svc_nanny_children", "nn_collection_people");

  it("does not ask about a setting for homework or outings alone", () => {
    expect(visible(attends(), { nn_duties_child: ["homework", "play"] })).toBe(false);
    expect(visible(settingName(), {
      nn_duties_child: ["homework"], nn_setting_attends: "yes",
    })).toBe(false);
  });

  it("asks whether the child attends a setting once the school run is chosen", () => {
    expect(visible(attends(), { nn_duties_child: ["school_run"] })).toBe(true);
    expect(visible(settingName(), { nn_duties_child: ["school_run"] })).toBe(false);
  });

  it("opens the setting details and collection contacts only on a yes", () => {
    const answers = { nn_duties_child: ["school_run"], nn_setting_attends: "yes" };
    for (const id of [
      "nn_setting_type", "nn_setting_name", "nn_setting_days", "nn_setting_start",
      "nn_setting_end", "nn_setting_area", "nn_setting_term",
    ]) {
      expect(visible(field("svc_nanny_children", id), answers)).toBe(true);
    }
    expect(visible(collection(), answers)).toBe(true);
    expect(visible(collection(), { ...answers, nn_setting_attends: "no" })).toBe(false);
  });

  it("hides the setting again when the school run is removed", () => {
    expect(visible(settingName(), { nn_duties_child: ["play"], nn_setting_attends: "yes" }))
      .toBe(false);
  });
});

describe("pre-assessment version 10: schedule, living arrangement and nights", () => {
  it("keeps living in the home out of the times of day", () => {
    expect(values("core_arrangements", "care_times")).not.toContain("live_in");
  });

  it("asks about living in the home once, in the nanny role", () => {
    expect(values("svc_nanny_role", "nn_pattern")).toEqual(["live_in", "live_out", "no_preference"]);
    expect(field("svc_nanny_role", "nn_pattern").asked).toBe("Would the nanny live in your home?");
  });

  it("asks about overnight responsibility only where the times include overnight", () => {
    const overnight = field("svc_nanny_role", "nn_overnight");
    expect(visible(overnight, { care_times: ["morning"] })).toBe(false);
    expect(visible(overnight, { care_times: ["overnight"] })).toBe(true);
    expect(visible(field("svc_nanny_role", "nn_overnight_nights"), {
      care_times: ["overnight"], nn_overnight: "yes",
    })).toBe(true);
  });
});

describe("pre-assessment version 10: duties", () => {
  it("keeps direct care for each child apart from the shared duties", () => {
    const child = values("svc_nanny_children", "nn_duties_child");
    const role = values("svc_nanny_role", "nn_duties");
    expect(child.filter((v) => role.includes(v))).toEqual([]);
    expect(child).not.toContain("overnight");
    expect(child).not.toContain("outings");
    expect(child).not.toContain("laundry");
    expect(role).not.toContain("childcare");
    expect(role).not.toContain("school_run");
  });
});
