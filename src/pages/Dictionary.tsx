// =====================================================================
// Diccionario — términos extraídos de las lecciones tipo "concept"
// =====================================================================
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookMarked, Search, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface Entry {
  id: string;
  course_id: string;
  lesson_id: string;
  term: string;
  definition: string;
  example: string | null;
  course_title?: string | null;
}

export default function Dictionary() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");

  const load = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    const { data: dict } = await supabase
      .from("course_dictionary")
      .select("id, course_id, lesson_id, term, definition, example")
      .eq("company_id", profile.company_id)
      .order("term", { ascending: true });

    const courseIds = [...new Set((dict ?? []).map((d) => d.course_id))];
    let titlesById: Record<string, string> = {};
    if (courseIds.length) {
      const { data: courses } = await supabase
        .from("courses")
        .select("id, title")
        .in("id", courseIds);
      titlesById = Object.fromEntries((courses ?? []).map((c) => [c.id, c.title]));
    }

    setEntries(
      (dict ?? []).map((d: any) => ({ ...d, course_title: titlesById[d.course_id] ?? null })),
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.company_id]);

  const courses = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach((e) => {
      if (e.course_id) map.set(e.course_id, e.course_title || "Curso");
    });
    return [...map.entries()];
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (courseFilter !== "all" && e.course_id !== courseFilter) return false;
      if (!q) return true;
      return (
        e.term.toLowerCase().includes(q) ||
        e.definition.toLowerCase().includes(q) ||
        (e.example ?? "").toLowerCase().includes(q)
      );
    });
  }, [entries, search, courseFilter]);

  // agrupar por inicial
  const grouped = useMemo(() => {
    const g: Record<string, Entry[]> = {};
    filtered.forEach((e) => {
      const k = (e.term[0] || "?").toUpperCase();
      g[k] = g[k] || [];
      g[k].push(e);
    });
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookMarked className="w-6 h-6 text-primary" /> Diccionario
        </h1>
        <p className="text-muted-foreground">
          Conceptos clave extraídos automáticamente de tus cursos.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar concepto..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant={courseFilter === "all" ? "default" : "outline"}
            onClick={() => setCourseFilter("all")}
          >
            Todos
          </Button>
          {courses.map(([id, title]) => (
            <Button
              key={id}
              size="sm"
              variant={courseFilter === id ? "default" : "outline"}
              onClick={() => setCourseFilter(id)}
            >
              {title}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-24 animate-pulse bg-muted" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookMarked className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="font-semibold">Aún no hay conceptos.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Cuando completes lecciones de tipo "Conceptos", se añadirán aquí automáticamente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([letter, items]) => (
            <section key={letter}>
              <h2 className="text-sm font-bold text-muted-foreground mb-2">{letter}</h2>
              <div className="space-y-2">
                {items.map((e, i) => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <Card className="shadow-card">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2">
                          <h3 className="font-bold text-foreground">{e.term}</h3>
                          {e.course_title && (
                            <Badge variant="secondary" className="text-[10px]">
                              {e.course_title}
                            </Badge>
                          )}
                          {e.course_id && e.lesson_id && (
                            <Link
                              to={`/app/courses/${e.course_id}/lessons/${e.lesson_id}`}
                              className="ml-auto text-xs text-primary inline-flex items-center gap-1 hover:underline"
                            >
                              Ir <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                        <p className="text-sm text-foreground/80 mt-1">{e.definition}</p>
                        {e.example && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            Ejemplo: {e.example}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
