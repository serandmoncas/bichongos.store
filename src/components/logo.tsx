type LogoVariant = "horizontal" | "inline" | "mono-negative" | "icon";

const SYMBOL_CIRCLES = [
  { cx: 27, cy: 16, r: 5, opacity: 1 },
  { cx: 16, cy: 26, r: 5, opacity: 0.75 },
  { cx: 38, cy: 26, r: 5, opacity: 0.75 },
  { cx: 27, cy: 36, r: 5, opacity: 0.5 },
];

function Symbol({
  outerFill,
  coreFill,
  size,
}: {
  outerFill: string;
  coreFill: string;
  size: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 54 54"
      role="img"
      aria-label="Símbolo Bichongos"
    >
      {SYMBOL_CIRCLES.map((c) => (
        <circle
          key={`${c.cx}-${c.cy}`}
          cx={c.cx}
          cy={c.cy}
          r={c.r}
          fill={outerFill}
          opacity={c.opacity}
        />
      ))}
      <circle cx={27} cy={26} r={3} fill={coreFill} />
    </svg>
  );
}

export function Logo({
  variant,
  className,
}: {
  variant: LogoVariant;
  className?: string;
}) {
  if (variant === "icon") {
    return (
      <div className={className}>
        <Symbol outerFill="var(--color-tinta)" coreFill="var(--color-musgo)" size={44} />
      </div>
    );
  }

  if (variant === "mono-negative") {
    return (
      <div className={`flex items-center gap-3 ${className ?? ""}`}>
        <Symbol outerFill="var(--color-crema)" coreFill="var(--color-tinta)" size={44} />
        <span className="font-mono text-2xl font-semibold text-crema">Bichongos</span>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className={`flex items-center gap-3 ${className ?? ""}`}>
        <Symbol outerFill="var(--color-musgo)" coreFill="var(--color-tinta)" size={36} />
        <span className="font-mono text-xl font-semibold text-tinta">Bichongos</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${className ?? ""}`}>
      <Symbol outerFill="var(--color-musgo)" coreFill="var(--color-tinta)" size={60} />
      <span className="font-mono text-2xl font-semibold text-tinta">Bichongos</span>
    </div>
  );
}
