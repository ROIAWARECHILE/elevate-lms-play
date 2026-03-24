import { motion } from "framer-motion";

import kibboCelebrating from "@/assets/kibbo-celebrating.png";
import kibboThumbsup from "@/assets/kibbo-thumbsup.png";
import kibboThinking from "@/assets/kibbo-thinking.png";
import kibboSurprised from "@/assets/kibbo-surprised.png";
import kibboSad from "@/assets/kibbo-sad.png";
import kibboDetermined from "@/assets/kibbo-determined.png";
import kibboSleeping from "@/assets/kibbo-sleeping.png";
import kibboDancing from "@/assets/kibbo-dancing.png";
import kibboExcited from "@/assets/kibbo-excited.png";

const images: Record<KibboExpressionType, string> = {
  celebrating: kibboCelebrating,
  thumbsup: kibboThumbsup,
  thinking: kibboThinking,
  surprised: kibboSurprised,
  sad: kibboSad,
  determined: kibboDetermined,
  sleeping: kibboSleeping,
  dancing: kibboDancing,
  excited: kibboExcited,
};

export type KibboExpressionType =
  | "celebrating"
  | "thumbsup"
  | "thinking"
  | "surprised"
  | "sad"
  | "determined"
  | "sleeping"
  | "dancing"
  | "excited";

const animations: Record<KibboExpressionType, object> = {
  celebrating: {
    initial: { scale: 0, rotate: -10 },
    animate: { scale: 1, rotate: 0, y: [0, -6, 0] },
    transition: { type: "spring", stiffness: 200, damping: 12, y: { repeat: Infinity, duration: 2 } },
  },
  thumbsup: {
    initial: { scale: 0 },
    animate: { scale: 1 },
    transition: { type: "spring", stiffness: 260, damping: 18 },
  },
  thinking: {
    initial: { opacity: 0, rotate: -5 },
    animate: { opacity: 1, rotate: [0, 3, -3, 0] },
    transition: { rotate: { repeat: Infinity, duration: 4, ease: "easeInOut" }, opacity: { duration: 0.4 } },
  },
  surprised: {
    initial: { scale: 0.3 },
    animate: { scale: [1.15, 1] },
    transition: { type: "spring", stiffness: 300, damping: 10 },
  },
  sad: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: "easeOut" },
  },
  determined: {
    initial: { scale: 0.8 },
    animate: { scale: 1 },
    transition: { type: "spring", stiffness: 200, damping: 15 },
  },
  sleeping: {
    initial: { opacity: 0 },
    animate: { opacity: 1, y: [0, -4, 0] },
    transition: { y: { repeat: Infinity, duration: 3, ease: "easeInOut" }, opacity: { duration: 0.5 } },
  },
  dancing: {
    initial: { scale: 0, rotate: -15 },
    animate: { scale: 1, rotate: [0, 8, -8, 0] },
    transition: { type: "spring", stiffness: 200, damping: 12, rotate: { repeat: Infinity, duration: 1.2 } },
  },
  excited: {
    initial: { scale: 0 },
    animate: { scale: [1.1, 1, 1.05, 1] },
    transition: { type: "spring", stiffness: 260, damping: 14 },
  },
};

interface Props {
  expression: KibboExpressionType;
  className?: string;
}

export function KibboExpression({ expression, className = "" }: Props) {
  const anim = animations[expression];
  return (
    <motion.img
      src={images[expression]}
      alt={`Kibbo ${expression}`}
      className={className}
      draggable={false}
      {...anim}
    />
  );
}
