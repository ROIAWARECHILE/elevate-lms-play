import { motion } from "framer-motion";

export function KibboMascot({ className = "" }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 120 120"
      className={className}
      initial={{ scale: 0, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
    >
      {/* Body */}
      <circle cx="60" cy="65" r="40" fill="hsl(var(--primary))" />
      {/* Face highlight */}
      <circle cx="60" cy="60" r="35" fill="hsl(var(--primary))" opacity="0.8" />
      {/* Left eye */}
      <ellipse cx="47" cy="55" rx="6" ry="7" fill="white" />
      <circle cx="48" cy="54" r="3.5" fill="hsl(222 47% 11%)" />
      <circle cx="49.5" cy="52.5" r="1.5" fill="white" />
      {/* Right eye */}
      <ellipse cx="73" cy="55" rx="6" ry="7" fill="white" />
      <circle cx="74" cy="54" r="3.5" fill="hsl(222 47% 11%)" />
      <circle cx="75.5" cy="52.5" r="1.5" fill="white" />
      {/* Mouth */}
      <path
        d="M50 70 Q60 80 70 70"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Blush */}
      <circle cx="40" cy="67" r="5" fill="hsl(var(--streak))" opacity="0.3" />
      <circle cx="80" cy="67" r="5" fill="hsl(var(--streak))" opacity="0.3" />
      {/* Cap */}
      <path
        d="M30 48 Q60 20 90 48"
        fill="hsl(var(--primary))"
        stroke="hsl(var(--primary-foreground))"
        strokeWidth="2"
      />
      <rect x="55" y="22" width="10" height="6" rx="3" fill="hsl(var(--xp))" />
    </motion.svg>
  );
}
