import { describe, expect, it } from "vitest";
import {
  appointmentTimesForPeriods,
  suggestedAppointmentDates,
} from "@/components/care/CareClinicalControls";

describe("assessment availability", () => {
  it("offers only future dates on the selected weekdays", () => {
    const dates = suggestedAppointmentDates(["mon", "wed", "fri"], new Date("2026-09-14T09:00:00Z"), 6);
    expect(dates).toEqual([
      "2026-09-16",
      "2026-09-18",
      "2026-09-21",
      "2026-09-23",
      "2026-09-25",
      "2026-09-28",
    ]);
  });

  it("offers exact times only within the selected periods", () => {
    expect(appointmentTimesForPeriods(["morning", "evening"])).toEqual([
      { period: "morning", start: "08:00", end: "09:00", label: "8:00 am–9:00 am" },
      { period: "morning", start: "09:00", end: "10:00", label: "9:00 am–10:00 am" },
      { period: "morning", start: "10:00", end: "11:00", label: "10:00 am–11:00 am" },
      { period: "morning", start: "11:00", end: "12:00", label: "11:00 am–12:00 pm" },
      { period: "evening", start: "16:00", end: "17:00", label: "4:00 pm–5:00 pm" },
      { period: "evening", start: "17:00", end: "18:00", label: "5:00 pm–6:00 pm" },
      { period: "evening", start: "18:00", end: "19:00", label: "6:00 pm–7:00 pm" },
      { period: "evening", start: "19:00", end: "20:00", label: "7:00 pm–8:00 pm" },
    ]);
  });

  it("does not invent dates or times before both answers exist", () => {
    expect(suggestedAppointmentDates(null, new Date("2026-09-14T09:00:00Z"))).toEqual([]);
    expect(appointmentTimesForPeriods(undefined)).toEqual([]);
  });
});