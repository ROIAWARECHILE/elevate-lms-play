import { motion } from "framer-motion";
import { forwardRef } from "react";
import kibboImg from "@/assets/kibbo-mascot.png";

export const KibboMascot = forwardRef<HTMLImageElement, { className?: string }>(
  ({ className = "" }, ref) => {
    return (
      <motion.img
        ref={ref}
        src={kibboImg}
        alt="Kibbo — mascota zorro"
        className={className}
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        draggable={false}
      />
    );
  },
);
KibboMascot.displayName = "KibboMascot";
