import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { SeasonalSnowfall } from "@/components/ui/SeasonalSnowfall";
import { getCurrentSeason, SeasonalThemeProvider } from "./seasonalThemes";

describe("seasonal themes", () => {
  it("selects Christmas and New Year only in their configured date ranges", () => {
    expect(getCurrentSeason(new Date(2026, 11, 15))).toBe("christmas");
    expect(getCurrentSeason(new Date(2026, 11, 25))).toBe("christmas");
    expect(getCurrentSeason(new Date(2026, 11, 26))).toBe("christmas");
    expect(getCurrentSeason(new Date(2026, 11, 27))).toBe("default");
    expect(getCurrentSeason(new Date(2026, 11, 28))).toBe("newyear");
    expect(getCurrentSeason(new Date(2027, 0, 5))).toBe("newyear");
    expect(getCurrentSeason(new Date(2027, 0, 6))).toBe("default");
  });

  it("renders the Christmas logo overlay and a non-interactive 18-particle snowfall layer", () => {
    const logo = renderToStaticMarkup(createElement(BrandLogo, { theme: "christmas" }));
    const snowfall = renderToStaticMarkup(createElement(SeasonalSnowfall));

    expect(logo).toContain("absolute -left-2 -top-2");
    expect(logo).toContain("<svg");
    expect(snowfall).toContain("pointer-events-none fixed inset-0 z-10");
    expect(snowfall.match(/class="seasonal-snowflake"/g)).toHaveLength(18);
  });

  it("renders a gilded sparkle overlay for New Year", () => {
    const logo = renderToStaticMarkup(createElement(BrandLogo, { theme: "newyear" }));

    expect(logo).toContain("#fbbf24");
    expect(logo).toContain("<svg");
  });

  it("renders the Christmas logo and snowfall together when the date is overridden to December 25", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 25, 12));

    try {
      const markup = renderToStaticMarkup(
        createElement(SeasonalThemeProvider, { children: createElement(BrandLogo) }),
      );

      expect(markup).toContain("theme-christmas");
      expect(markup).toContain("absolute -left-2 -top-2");
      expect(markup.match(/class="seasonal-snowflake"/g)).toHaveLength(18);
      expect(markup).toContain("pointer-events-none fixed inset-0 z-10");
    } finally {
      vi.useRealTimers();
    }
  });
});
