import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AppIcon } from "./AppIcon";
import { APP_ICON_PATHS } from "./app-icon-paths";

afterEach(cleanup);

describe("AppIcon", () => {
  it("has the whole app set, one path each", () => {
    expect(Object.keys(APP_ICON_PATHS)).toHaveLength(51);
    for (const d of Object.values(APP_ICON_PATHS)) expect(d).toMatch(/^M[\d .MLHVZACQSTmlhvzacqst-]+$/);
  });

  it("is hidden beside a label and named when it stands alone", () => {
    const { container } = render(<button type="button"><AppIcon name="check-in" />Check in</button>);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("button", { name: "Check in" })).toBeTruthy();
    render(<AppIcon name="emergency" label="Emergency" size={24} />);
    const named = screen.getByRole("img", { name: "Emergency" });
    expect(named.getAttribute("stroke")).toBe("currentColor");
    expect(named.getAttribute("width")).toBe("24");
  });
});
