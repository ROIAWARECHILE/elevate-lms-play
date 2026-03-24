import { motion } from "framer-motion";
import kibboImg from "@/assets/kibbo-mascot.png";

export function KibboMascot({ className = "" }: { className?: string }) {
  return (
    <motion.img
      src={kibboImg}
      alt="Kibbo — mascota zorro"
      className={className}
      initial={{ scale: 0, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      draggable={false}
    />
  );
}
