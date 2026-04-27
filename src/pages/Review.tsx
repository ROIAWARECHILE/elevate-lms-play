// =====================================================================
// Repasar errores — el alumno revisa los ejercicios que marcó como "a repaso"
// =====================================================================
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2, RefreshCw, Trash2, Sparkles, BookmarkCheck, Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Mistake {
  id: string;
  block_type: string;
  question: string;
  user_answer: string | null;
  correct_answer: string;
  explanation: string | null;
  times_failed: number;
  times_reviewed: number;
  mastered: boolean;
  last_failed_at: string;
  course_id: string | null;
  lesson_id: string | null;
}

export default function Review() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Mistake[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "mastered" | "all">("pending");
  const [search, setSearch] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_mistakes")
      .select("*")
      .eq("user_id", user.id)
      .order("last_failed_at", { ascending: false });
    setItems((data ?? []) as Mistake[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const filtered = useMemo(() => {
    return items
      .filter((m) =>
        filter === "all" ? true : filter === "mastered" ? m.mastered : !m.mastered,
      )
      .filter((m) =>
        search.trim() === "" ? true : m.question.toLowerCase().includes(search.toLowerCase()),
      );
  }, [items, filter, search]);

  const markMastered = async (id: string) => {
    await supabase
      .from("user_mistakes")
      .update({
        mastered: true,
        last_reviewed_at: new Date().toISOString(),
        times_reviewed: (items.find((i) => i.id === id)?.times_reviewed ?? 0) + 1,
      })
      .eq("id", id);
    toast({ title: "¡Concepto dominado!", description: "Lo marcamos como aprendido." });
    load();
  };

  const markPending = async (id: string) => {
    await supabase.from("user_mistakes").update({ mastered: false }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("user_mistakes").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <RefreshCw className="w-6 h-6 text-primary" /> Repasar errores
        </h1>
        <p className="text-muted-foreground">
          Estos son los ejercicios que marcaste para repasar. Practícalos hasta dominarlos.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["pending", "mastered", "all"] as const).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={filter === k ? "default" : "outline"}
            onClick={() => setFilter(k)}
          >
            {k === "pending" ? "Pendientes" : k === "mastered" ? "Dominados" : "Todos"}
          </Button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-24 animate-pulse bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <h3 className="font-semibold">
              {filter === "mastered" ? "Aún no has dominado ningún concepto." : "¡Sin errores pendientes!"}
            </h3>
            <p className="text-muted-foreground text-sm mt-1">
              Cuando falles un ejercicio podrás añadirlo aquí desde la lección.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="shadow-card">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {m.block_type.replace("_", " ")}
                    </Badge>
                    {m.mastered && (
                      <Badge className="bg-success/20 text-success border-success/40 text-[10px]">
                        Dominado
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      Fallado {m.times_failed}× · Repasado {m.times_reviewed}×
                    </span>
                  </div>
                  <p className="font-medium text-foreground">{m.question}</p>
                  {m.user_answer && (
                    <p className="text-xs text-destructive/80">
                      Tu respuesta: <span className="font-mono">{m.user_answer}</span>
                    </p>
                  )}
                  {revealed[m.id] ? (
                    <div className="rounded-lg bg-success/10 text-success p-3 text-sm">
                      <p className="font-semibold">Respuesta correcta</p>
                      <p>{m.correct_answer}</p>
                      {m.explanation && <p className="text-xs opacity-80 mt-1">{m.explanation}</p>}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRevealed((r) => ({ ...r, [m.id]: true }))}
                    >
                      Mostrar respuesta
                    </Button>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    {!m.mastered ? (
                      <Button size="sm" onClick={() => markMastered(m.id)}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Lo domino
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => markPending(m.id)}>
                        <BookmarkCheck className="w-4 h-4 mr-1" /> Volver a pendiente
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => remove(m.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
