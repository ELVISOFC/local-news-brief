export function StoryArt({ hue, label, size = "md" }: { hue: number; label?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-14 w-14", md: "h-20 w-20", lg: "h-40 w-full" };
  return (
    <div
      className={`${sizes[size]} shrink-0 overflow-hidden rounded-2xl border border-border relative`}
      style={{
        background: `linear-gradient(135deg, oklch(0.72 0.12 ${hue}) 0%, oklch(0.42 0.1 ${(hue + 40) % 360}) 100%)`,
      }}
    >
      <div className="absolute inset-0 opacity-30" style={{
        background: `radial-gradient(circle at 30% 20%, oklch(1 0 0 / 0.5), transparent 60%)`,
      }} />
      {label ? (
        <span className="absolute bottom-1 left-2 text-[10px] font-medium uppercase tracking-wider text-white/90">{label}</span>
      ) : null}
    </div>
  );
}
