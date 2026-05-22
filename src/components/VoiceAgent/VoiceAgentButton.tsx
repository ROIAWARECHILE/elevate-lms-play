import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Headphones } from "lucide-react";
import { ConversationProvider, useConversationStatus } from "@elevenlabs/react";
import { VoiceAgentPanel } from "./VoiceAgentPanel";

function VoiceAgentButtonInner() {
  const [open, setOpen] = useState(false);
  const { status } = useConversationStatus();
  const isActive = status === "connected";

  return (
    <>
      <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50">
        <AnimatePresence>
          {isActive && (
            <motion.span
              key="pulse"
              className="absolute inset-0 rounded-full gradient-primary opacity-40"
              initial={{ scale: 1, opacity: 0.4 }}
              animate={{ scale: 1.6, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setOpen(true)}
          className="relative w-14 h-14 rounded-full gradient-primary shadow-xl flex items-center justify-center text-primary-foreground"
          title="Asistente de voz"
        >
          <Headphones className="w-6 h-6" />
        </motion.button>
      </div>

      <VoiceAgentPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function VoiceAgentButton() {
  const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID as string | undefined;
  if (!agentId) return null;

  return (
    <ConversationProvider>
      <VoiceAgentButtonInner />
    </ConversationProvider>
  );
}
