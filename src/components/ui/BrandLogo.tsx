import { useSeasonalTheme, type SeasonalTheme } from "@/lib/seasonalThemes";

type BrandLogoProps = {
  alt?: string;
  className?: string;
  imageClassName?: string;
  theme?: SeasonalTheme | "easter";
};

export function BrandLogo({
  alt = "PalNet",
  className = "size-10",
  imageClassName = "size-full object-cover",
  theme: themeOverride,
}: BrandLogoProps) {
  const { theme: currentTheme } = useSeasonalTheme();
  const theme = themeOverride ?? currentTheme;

  return (
    <span className={`relative inline-block shrink-0 ${className}`}>
      <img src="/favicon.png" alt={alt} className={imageClassName} />
      {theme === "christmas" && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute -left-2 -top-2 z-10 h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M4 17.5 17.5 4c.5 4.4 1.2 7.5 3.5 10.2L10.4 21c-2.2-2.3-4.1-3.1-6.4-3.5Z"
            fill="#dc2626"
          />
          <path d="m4 17.5 6.4 3.5-1.1 1.1a2.8 2.8 0 0 1-4-3.9L4 17.5Z" fill="#fff" />
          <path d="m17.5 4 .3-.8a2 2 0 0 1 3.8.8l-.6 1.5L17.5 4Z" fill="#fff" />
          <path d="m5.2 16.3 2.6 2.6" stroke="#fecaca" strokeWidth="1" />
        </svg>
      )}
      {theme === "newyear" && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute -left-1.5 -top-1.5 z-10 size-6"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="#fbbf24"
            fillOpacity=".94"
            stroke="#fef3c7"
            strokeWidth="1.2"
          />
          <path d="m12 4 1.8 5.6L19 12l-5.2 2.1L12 20l-2-5.9L5 12l5-2.4L12 4Z" fill="#fff7d6" />
          <circle cx="18.5" cy="5" r="1" fill="#fff7d6" />
        </svg>
      )}
      {theme === "easter" && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute -left-1.5 -top-1.5 z-10 size-6"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="#34d399"
            fillOpacity=".94"
            stroke="#d1fae5"
            strokeWidth="1.2"
          />
          <path
            d="M12 6.2c1.7 0 2.5 2.6 1.1 4.3 2.2-1.1 4.3.1 4.3 1.8s-2.1 2.9-4.3 1.8c1.4 1.7.6 4.3-1.1 4.3s-2.5-2.6-1.1-4.3c-2.2 1.1-4.3-.1-4.3-1.8s2.1-2.9 4.3-1.8C9.5 8.8 10.3 6.2 12 6.2Z"
            fill="#ecfdf5"
          />
          <circle cx="12" cy="12.3" r="1.4" fill="#059669" />
        </svg>
      )}
    </span>
  );
}
