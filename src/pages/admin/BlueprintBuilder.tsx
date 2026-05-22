import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  Layers, Plus, Trash2, ArrowLeft, Save, Copy, BookOpen, Lightbulb,
  ListOrdered, Columns3, Briefcase, Brain, Globe, Building2, ChevronDown, ChevronUp,
} from "lucide-react";
import { Link } from "react-router-dom";

interface BlueprintLesson {
  lesson_type: string;
  title_template: string;
}

interface BlueprintModule {
  title_template: string;
  order_index: number;
  lessons: BlueprintLesson[];
}

interface BlueprintStructure {
  modules: BlueprintModule[];
  variables: string[];
  pedagogy: {
    sequence?: string;
    min_xp_per_module?: number;
    include_case_studies?: boolean;
    include_objections?: boolean;
    include_postsale?: boolean;
  };
}

interface Blueprint {
  id: string;
  company_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  structure: BlueprintStructure;
  is_template: boolean;
  version: number;
  created_at: string;
}

const LESSON_TYPES = [
  { value: "reading", label: "Lectura", icon: BookOpen },
  { value: "concept", label: "Conceptos", icon: Lightbulb },
  { value: "flashcards", label: "Tarjetas", icon: Layers },
  { value: "steps", label: "Pasos", icon: ListOrdered },
  { value: "comparison", label: "Comparativa", icon: Columns3 },
  { value: "case_study", label: "Caso", icon: Briefcase },
  { value: "interactive_quiz", label: "Quiz", icon: Brain },
  { value: "sop_walkthrough", label: "Procedimiento", icon: ListOrdered },
];

const CATEGORY_LABELS: Record<string, string> = {
  sales: "Ventas", onboarding: "Onboarding", product: "Producto",
  compliance: "Cumplimiento", cx: "Customer Success",
};

function LessonTypeIcon({ type, className }: { type: string; className?: string }) {
  const found = LESSON_TYPES.find((t) => t.value === type);
  if (!found) return <BookOpen className={className} />;
  const Icon = found.icon;
  return <Icon className={className} />;
}

function emptyStructure(): BlueprintStructure {
  return {
    modules: [{ title_template: "Módulo 1", order_index: 1, lessons: [] }],
    variables: [],
    pedagogy: { sequence: "", min_xp_per_module: 40, include_case_studies: true },
  };
}

export default function BlueprintBuilder() {
  const { blueprintId } = useParams<{ blueprintId: string }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { toast } = useToast();

  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Blueprint | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set([0]));

  const fetchBlueprints = async () => {
    if (!profile?.company_id) return;
    const { data } = await supabase
      .from("course_blueprints" as any)
      .select("*")
      .or(`company_id.eq.${profile.company_id},company_id.is.null`)
      .order("is_template", { ascending: false })
      .order("created_at", { ascending: true });
    if (data) setBlueprints(data as Blueprint[]);
    setLoading(false);
  };

  useEffect(() => { fetchBlueprints(); }, [profile?.company_id]);

  useEffect(() => {
    if (blueprintId && blueprints.length > 0) {
      const bp = blueprints.find((b) => b.id === blueprintId);
      if (bp) startEdit(bp);
    }
  }, [blueprintId, blueprints]);

  const startEdit = (bp: Blueprint) => {
    setEditing({ ...bp, structure: JSON.parse(JSON.stringify(bp.structure)) });
    setExpandedModules(new Set([0]));
  };

  const startNew = () => {
    setEditing({
      id: "",
      company_id: profile?.company_id || null,
      slug: "",
      name: "",
      description: "",
      category: "",
      structure: emptyStructure(),
      is_template: false,
      version: 1,
      created_at: new Date().toISOString(),
    });
    setExpandedModules(new Set([0]));
  };

  const cloneBlueprint = (bp: Blueprint) => {
    setEditing({
      ...bp,
      id: "",
      company_id: profile?.company_id || null,
      name: `${bp.name} (copia)`,
      slug: `${bp.slug}-copy-${Date.now()}`,
      is_template: false,
      structure: JSON.parse(JSON.stringify(bp.structure)),
    });
    setExpandedModules(new Set([0]));
  };

  const handleSave = async () => {
    if (!editing || !profile?.company_id || !user) return;
    if (!editing.name.trim()) {
      toast({ title: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const slug = editing.slug.trim() || editing.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const payload = {
        company_id: profile.company_id,
        slug,
        name: editing.name,
        description: editing.description || null,
        category: editing.category || null,
        structure: editing.structure,
        is_template: false,
        version: editing.version || 1,
        created_by: user.id,
      };
      if (editing.id) {
        const { error } = await supabase.from("course_blueprints" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Blueprint actualizado" });
      } else {
        const { error } = await supabase.from("course_blueprints" as any).insert(payload);
        if (error) throw error;
        toast({ title: "Blueprint creado" });
      }
      fetchBlueprints();
      setEditing(null);
    } catch (e: any) {
      toast({ title: "Error al guardar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateStructure = (fn: (s: BlueprintStructure) => void) => {
    if (!editing) return;
    const s = JSON.parse(JSON.stringify(editing.structure)) as BlueprintStructure;
    fn(s);
    setEditing({ ...editing, structure: s });
  };

  const addModule = () => updateStructure((s) => {
    const idx = s.modules.length;
    s.modules.push({ title_template: `Módulo ${idx + 1}`, order_index: idx + 1, lessons: [] });
    setExpandedModules((prev) => new Set([...prev, idx]));
  });

  const removeModule = (mi: number) => updateStructure((s) => { s.modules.splice(mi, 1); });

  const addLesson = (mi: number) => updateStructure((s) => {
    s.modules[mi].lessons.push({ lesson_type: "reading", title_template: "Nueva lección" });
  });

  const removeLesson = (mi: number, li: number) => updateStructure((s) => {
    s.modules[mi].lessons.splice(li, 1);
  });

  const updateLesson = (mi: number, li: number, field: keyof BlueprintLesson, val: string) =>
    updateStructure((s) => { (s.modules[mi].lessons[li] as any)[field] = val; });

  const updateModule = (mi: number, field: keyof BlueprintModule, val: string) =>
    updateStructure((s) => { (s.modules[mi] as any)[field] = val; });

  const toggleModule = (idx: number) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const addVariable = () => updateStructure((s) => { s.variables.push(""); });
  const updateVariable = (i: number, val: string) => updateStructure((s) => { s.variables[i] = val; });
  const removeVariable = (i: number) => updateStructure((s) => { s.variables.splice(i, 1); });

  if (editing) {
    return (
      <div className="space-y-6 pb-16">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setEditing(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{editing.id ? "Editar blueprint" : "Nuevo blueprint"}</h1>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gradient-primary">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <Label>Nombre *</Label>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ej: Ventas B2B para SaaS" />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label>Categoría</Label>
              <Select value={editing.category || ""} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Variables del blueprint</Label>
              <div className="space-y-1 mt-1">
                {editing.structure.variables.map((v, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={v}
                      onChange={(e) => updateVariable(i, e.target.value)}
                      placeholder="Ej: brand"
                      className="font-mono text-sm"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeVariable(i)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addVariable}>
                  <Plus className="w-3 h-3 mr-1" /> Variable
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Módulos y lecciones</h2>
            <Button variant="outline" size="sm" onClick={addModule}>
              <Plus className="w-4 h-4 mr-1" /> Módulo
            </Button>
          </div>

          {editing.structure.modules.map((mod, mi) => (
            <Card key={mi} className="shadow-card">
              <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleModule(mi)}>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {mi + 1}
                  </div>
                  <Input
                    value={mod.title_template}
                    onChange={(e) => updateModule(mi, "title_template", e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium border-none shadow-none p-0 h-auto focus-visible:ring-0 bg-transparent"
                  />
                  <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                    <Badge variant="secondary" className="text-xs">{mod.lessons.length} lecciones</Badge>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-7 w-7" onClick={() => removeModule(mi)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    {expandedModules.has(mi) ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
              </CardHeader>

              {expandedModules.has(mi) && (
                <CardContent className="pt-0 space-y-2">
                  {mod.lessons.map((les, li) => (
                    <div key={li} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <LessonTypeIcon type={les.lesson_type} className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <Select value={les.lesson_type} onValueChange={(v) => updateLesson(mi, li, "lesson_type", v)}>
                        <SelectTrigger className="w-36 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LESSON_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={les.title_template}
                        onChange={(e) => updateLesson(mi, li, "title_template", e.target.value)}
                        className="h-7 text-xs"
                        placeholder="Título de la lección"
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeLesson(mi, li)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" className="w-full mt-1 text-xs text-muted-foreground" onClick={() => addLesson(mi)}>
                    <Plus className="w-3 h-3 mr-1" /> Añadir lección
                  </Button>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" /> Blueprints pedagógicos
          </h1>
          <p className="text-muted-foreground">
            Plantillas de estructura de curso. Reutiliza la metodología en múltiples cursos.
          </p>
        </div>
        <Button onClick={startNew} className="gradient-primary shadow-primary">
          <Plus className="w-4 h-4 mr-2" /> Nuevo blueprint
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Card key={i} className="h-20 animate-pulse bg-muted" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {blueprints.map((bp, i) => {
            const isGlobal = bp.company_id === null;
            const totalLessons = bp.structure.modules.reduce((acc, m) => acc + m.lessons.length, 0);
            return (
              <motion.div key={bp.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className="shadow-card hover:shadow-elevated transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      {isGlobal ? <Globe className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{bp.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {isGlobal && <Badge variant="secondary" className="text-xs">Global Kibbo</Badge>}
                        {bp.category && <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[bp.category] || bp.category}</Badge>}
                        <span className="text-xs text-muted-foreground">
                          {bp.structure.modules.length} módulos · {totalLessons} lecciones
                        </span>
                        {bp.structure.variables.length > 0 && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {"{" + bp.structure.variables.join("}, {") + "}"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => cloneBlueprint(bp)} title="Clonar como blueprint de tu empresa">
                        <Copy className="w-4 h-4 mr-1" /> Clonar
                      </Button>
                      {!isGlobal && (
                        <Button variant="ghost" size="sm" onClick={() => startEdit(bp)}>
                          Editar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
