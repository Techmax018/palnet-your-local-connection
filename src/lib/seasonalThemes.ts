import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SeasonalSnowfall } from "@/components/ui/SeasonalSnowfall";

export type SeasonalTheme = "default" | "christmas" | "newyear";

export const SEASONAL_THEME_PREFERENCE_KEY = "palnet.seasonal-themes.enabled";

export function getCurrentSeason(date: Date = new Date()): SeasonalTheme {
  const month = date.getMonth();
  const day = date.getDate();

  if (month === 11 && day >= 15 && day <= 26) return "christmas";
  if ((month === 11 && day >= 28) || (month === 0 && day <= 5)) return "newyear";
  return "default";
}

type SeasonalThemeContextValue = {
  theme: SeasonalTheme;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
};

const SeasonalThemeContext = createContext<SeasonalThemeContextValue>({
  theme: getCurrentSeason(),
  enabled: true,
  setEnabled: () => undefined,
});

function readPreference(): boolean {
  try {
    return window.localStorage.getItem(SEASONAL_THEME_PREFERENCE_KEY) !== "false";
  } catch (error) {
    console.error("Could not read seasonal theme preference.", error);
    return true;
  }
}

export function SeasonalThemeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(true);
  const [season, setSeason] = useState(() => getCurrentSeason());
  const theme = enabled ? season : "default";

  useEffect(() => {
    setEnabledState(readPreference());

    const refreshSeason = () => setSeason(getCurrentSeason());
    const refreshPreference = (event: StorageEvent) => {
      if (event.key === SEASONAL_THEME_PREFERENCE_KEY) {
        setEnabledState(event.newValue !== "false");
      }
    };
    const timer = window.setInterval(refreshSeason, 60_000);

    window.addEventListener("storage", refreshPreference);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", refreshPreference);
    };
  }, []);

  useEffect(() => {
    const oldThemes: SeasonalTheme[] = ["default", "christmas", "newyear"];
    document.body.classList.remove(...oldThemes.map((name) => `theme-${name}`));
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  const value = useMemo<SeasonalThemeContextValue>(
    () => ({
      theme,
      enabled,
      setEnabled: (nextEnabled) => {
        window.localStorage.setItem(SEASONAL_THEME_PREFERENCE_KEY, String(nextEnabled));
        setEnabledState(nextEnabled);
      },
    }),
    [enabled, theme],
  );

  return createElement(
    SeasonalThemeContext.Provider,
    { value },
    createElement(
      "div",
      { className: `seasonal-theme-container theme-${theme}` },
      children,
      theme === "christmas" ? createElement(SeasonalSnowfall) : null,
    ),
  );
}

export function useSeasonalTheme(): SeasonalThemeContextValue {
  return useContext(SeasonalThemeContext);
}
