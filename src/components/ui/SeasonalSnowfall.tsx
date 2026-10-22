const SNOWFLAKE_COUNT = 18;

export function SeasonalSnowfall() {
  return (
    <div
      className="seasonal-snowfall pointer-events-none fixed inset-0 z-10 overflow-hidden opacity-40"
      aria-hidden="true"
    >
      {Array.from({ length: SNOWFLAKE_COUNT }, (_, index) => (
        <i key={index} className="seasonal-snowflake" />
      ))}
    </div>
  );
}
