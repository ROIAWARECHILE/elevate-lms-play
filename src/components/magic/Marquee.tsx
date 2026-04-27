// Inspired by Magic UI's Marquee — infinite horizontal scroll.
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface MarqueeProps {
  className?: string;
  children: ReactNode;
  pauseOnHover?: boolean;
  reverse?: boolean;
  slow?: boolean;
}

export function Marquee({ className, children, pauseOnHover = true, reverse = false, slow = false }: MarqueeProps) {
  return (
    <div className={cn("group flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]", className)}>
      <div
        className={cn(
          "flex shrink-0 gap-6 pr-6",
          slow ? "animate-marquee-slow" : "animate-marquee",
          reverse && "[animation-direction:reverse]",
          pauseOnHover && "group-hover:[animation-play-state:paused]",
        )}
      >
        {children}
        {children}
      </div>
    </div>
  );
}
