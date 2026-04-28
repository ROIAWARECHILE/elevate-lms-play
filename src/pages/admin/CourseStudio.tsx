// =====================================================================
// Course Studio — Wizard profesional multi-fuente para crear cursos.
// Pasos: Sources → Brief → Outline → Generar.
// =====================================================================

import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import {
  ArrowLeft, ArrowRight, FileText, Image as ImageIcon, Link2, Type,
  Sheet as SheetIcon, Upload, X, Sparkles, Check, Loader2, BookOpen,
  Lightbulb, Layers, ListOrdered, Columns3, Briefcase, Brain,
  Plus, Trash2, ArrowUp, ArrowDown, RefreshCw, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type SourceKind = "pdf" | "image" | "text" | "url" | "excel";
interface Source {
  id: string;
  kind: SourceKind;
  name: string;
  payload?: string; // base64 or text content
  text?: string; // for url, fetched text
  metadata?: any;
}

const STEPS = ["Fuentes", "Brief", "Outline", "Generar"] as const;

// File size caps (MB → bytes) to keep edge function payloads manageable.
const SIZE_CAPS: Record<"pdf" | "image" | "excel", number> = {
  pdf: 15 * 1024 * 1024,
  image: 8 * 1024 * 1024,
  excel: 5 * 1024 * 1024,
};

const TYPE_ICON: Record<string, any> = {
  reading: BookOpen, concept: Lightbulb, flashcards: Layers, steps: ListOrdered,
  comparison: Columns3, case_study: Briefcase, interactive_quiz: Brain,
  sop_walkthrough: ListOrdered,
};
const TYPE_LABEL: Record<string, string> = {
  reading: "Lectura", concept: "Conceptos", flashcards: "Tarjetas", steps: "Pasos",
  comparison: "Comparativa", case_study: "Caso", interactive_quiz: "Quiz",
  sop_walkthrough: "Procedimiento",
};

type ModuleStatus = "pending" | "in_progress" | "done" | "skipped" | "deleted";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function excelToMarkdown(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const out: string[] = [];
        for (const sheetName of wb.SheetNames) {
          out.push(`### ${sheetName}\n`);
          const sheet = wb.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          out.push(csv);
          out.push("\n");
        }
        resolve(out.join("\n").slice(0, 30_000));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function CourseStudio() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [userNotes, setUserNotes] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [textInput, setTextInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  const [brief, setBrief] = useState<any>(null);
  const [outline, setOutline] = useState<any>(null);

  // Generation state
  const [genProgress, setGenProgress] = useState(0); // 0..100
  const [moduleStatuses, setModuleStatuses] = useState<ModuleStatus[]>([]);
  const cancelRef = useRef(false);

  // Brief richness gate
  const briefRichness = useMemo(() => {
    if (!brief) return 0;
    const c = brief.key_concepts?.length || 0;
    const f = brief.facts?.length || 0;
    const p = brief.procedures?.length || 0;
    return c + f + p;
  }, [brief]);

  const outlineValid = useMemo(() => {
    if (!outline?.modules?.length) return false;
    return outline.modules.every((m: any) => Array.isArray(m.lessons) && m.lessons.length > 0);
  }, [outline]);

  const canNext = useMemo(() => {
    if (step === 0) return title.trim().length >= 3 && sources.length > 0;
    if (step === 1) return !!brief && briefRichness > 0;
    if (step === 2) return outlineValid;
    return false;
  }, [step, title, sources, brief, briefRichness, outlineValid]);

  // ----- Source handlers -----
  const addFiles = async (files: FileList | null, kind: "pdf" | "image", inputEl?: HTMLInputElement) => {
    if (!files) return;
    const next: Source[] = [];
    for (const f of Array.from(files)) {
      if (f.size > SIZE_CAPS[kind]) {
        toast({
          title: "Archivo demasiado grande",
          description: `${f.name} excede el límite de ${Math.round(SIZE_CAPS[kind] / (1024 * 1024))} MB.`,
          variant: "destructive",
        });
        continue;
      }
      try {
        const payload = await fileToBase64(f);
        next.push({ id: crypto.randomUUID(), kind, name: f.name, payload });
      } catch {
        toast({ title: "Error", description: `No se pudo leer ${f.name}`, variant: "destructive" });
      }
    }
    if (next.length) {
      setSources((s) => [...s, ...next]);
      toast({ title: "Fuente añadida", description: `${next.length} archivo(s) cargados.` });
    }
    if (inputEl) inputEl.value = "";
  };

  const addExcel = async (files: FileList | null, inputEl?: HTMLInputElement) => {
    if (!files) return;
    const next: Source[] = [];
    for (const f of Array.from(files)) {
      if (f.size > SIZE_CAPS.excel) {
        toast({
          title: "Archivo demasiado grande",
          description: `${f.name} excede el límite de ${Math.round(SIZE_CAPS.excel / (1024 * 1024))} MB.`,
          variant: "destructive",
        });
        continue;
      }
      try {
        const md = await excelToMarkdown(f);
        next.push({ id: crypto.randomUUID(), kind: "excel", name: f.name, payload: md });
      } catch {
        toast({ title: "Error", description: `No se pudo leer ${f.name}`, variant: "destructive" });
      }
    }
    if (next.length) {
      setSources((s) => [...s, ...next]);
      toast({ title: "Fuente añadida", description: `${next.length} hoja(s) cargadas.` });
    }
    if (inputEl) inputEl.value = "";
  };

  const addText = () => {
    if (!textInput.trim()) return;
    setSources((s) => [
      ...s,
      { id: crypto.randomUUID(), kind: "text", name: `Texto ${s.filter((x) => x.kind === "text").length + 1}`, payload: textInput.trim() },
    ]);
    setTextInput("");
    toast({ title: "Texto añadido" });
  };

  const addUrl = async () => {
    const u = urlInput.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) {
      toast({ title: "URL inválida", description: "La URL debe empezar con http:// o https://", variant: "destructive" });
      return;
    }
    setLoading(true);
    setProgressMsg(`Descargando ${u}…`);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-source", { body: { url: u } });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Fetch failed");
      setSources((s) => [
        ...s,
        {
          id: crypto.randomUUID(),
          kind: "url",
          name: data.title || u,
          payload: u,
          text: data.text,
          metadata: { url: u },
        },
      ]);
      setUrlInput("");
      toast({ title: "URL añadida", description: data.title || u });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setProgressMsg("");
    }
  };

  const removeSource = (id: string) => setSources((s) => s.filter((x) => x.id !== id));

  // ----- Pipeline -----
  const runExtract = async () => {
    if (!profile?.company_id || !user?.id) return;
    setLoading(true);
    setProgressMsg("Extrayendo conceptos clave de las fuentes…");
    try {
      const payload = {
        mode: "extract",
        companyId: profile.company_id,
        userId: user.id,
        userNotes,
        sources: sources.map((s) => ({
          kind: s.kind,
          name: s.name,
          payload: s.payload,
          text: s.text,
          metadata: s.metadata,
        })),
      };
      const { data, error } = await supabase.functions.invoke("generate-course", { body: payload });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Extract failed");
      setBrief(data.brief);
      setStep(1);
    } catch (e: any) {
      toast({ title: "Error en extracción", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setProgressMsg("");
    }
  };

  const runOutline = async () => {
    if (!profile?.company_id || !user?.id || !brief) return;
    setLoading(true);
    setProgressMsg("Diseñando módulos y eligiendo el tipo de cada lección…");
    try {
      const { data, error } = await supabase.functions.invoke("generate-course", {
        body: {
          mode: "outline",
          companyId: profile.company_id,
          userId: user.id,
          title,
          level,
          userNotes,
          brief,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Outline failed");
      setOutline(data.outline);
      setStep(2);
    } catch (e: any) {
      toast({ title: "Error en outline", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setProgressMsg("");
    }
  };

  // ----- Outline editing helpers -----
  const updateModule = (mi: number, patch: any) => {
    setOutline((o: any) => {
      const next = { ...o, modules: [...o.modules] };
      next.modules[mi] = { ...next.modules[mi], ...patch };
      return next;
    });
  };
  const updateLesson = (mi: number, li: number, patch: any) => {
    setOutline((o: any) => {
      const next = { ...o, modules: [...o.modules] };
      const lessons = [...(next.modules[mi].lessons || [])];
      lessons[li] = { ...lessons[li], ...patch };
      next.modules[mi] = { ...next.modules[mi], lessons };
      return next;
    });
  };
  const addLesson = (mi: number) => {
    setOutline((o: any) => {
      const next = { ...o, modules: [...o.modules] };
      const lessons = [...(next.modules[mi].lessons || [])];
      lessons.push({
        title: "Nueva lección",
        lesson_type: "reading",
        objective: "Definir el objetivo de aprendizaje.",
      });
      next.modules[mi] = { ...next.modules[mi], lessons };
      return next;
    });
  };
  const removeLesson = (mi: number, li: number) => {
    setOutline((o: any) => {
      const next = { ...o, modules: [...o.modules] };
      const lessons = [...(next.modules[mi].lessons || [])];
      lessons.splice(li, 1);
      next.modules[mi] = { ...next.modules[mi], lessons };
      return next;
    });
  };
  const moveLesson = (mi: number, li: number, dir: -1 | 1) => {
    setOutline((o: any) => {
      const next = { ...o, modules: [...o.modules] };
      const lessons = [...(next.modules[mi].lessons || [])];
      const ni = li + dir;
      if (ni < 0 || ni >= lessons.length) return o;
      [lessons[li], lessons[ni]] = [lessons[ni], lessons[li]];
      next.modules[mi] = { ...next.modules[mi], lessons };
      return next;
    });
  };
  const removeModule = (mi: number) => {
    setOutline((o: any) => {
      const next = { ...o, modules: [...o.modules] };
      next.modules.splice(mi, 1);
      return next;
    });
  };
  const moveModule = (mi: number, dir: -1 | 1) => {
    setOutline((o: any) => {
      const ni = mi + dir;
      if (ni < 0 || ni >= o.modules.length) return o;
      const next = { ...o, modules: [...o.modules] };
      [next.modules[mi], next.modules[ni]] = [next.modules[ni], next.modules[mi]];
      return next;
    });
  };

  const runMaterialize = async () => {
    if (!profile?.company_id || !user?.id || !brief || !outline) return;
    cancelRef.current = false;
    setLoading(true);
    setStep(3);
    const totalModules = outline.modules?.length || 0;
    setModuleStatuses(Array(totalModules).fill("pending") as ModuleStatus[]);
    setGenProgress(0);
    setProgressMsg(`Creando estructura del curso…`);

    let courseId: string | null = null;
    try {
      // 1) Init: create course shell + empty modules
      const initRes = await supabase.functions.invoke("generate-course", {
        body: {
          mode: "materialize_init",
          companyId: profile.company_id,
          userId: user.id,
          title,
          level,
          brief,
          outline,
          sources: sources.map((s) => ({ kind: s.kind, name: s.name, metadata: s.metadata })),
        },
      });
      if (initRes.error || initRes.data?.error)
        throw new Error(initRes.data?.error || initRes.error?.message || "Init failed");
      const init = initRes.data as { courseId: string; moduleIds: string[] };
      courseId = init.courseId;
      const moduleIds = init.moduleIds;

      // 2) Materialize each module sequentially
      let totalSkipped = 0;
      let totalInserted = 0;
      let okModules = 0;
      let deletedModules = 0;
      for (let mi = 0; mi < totalModules; mi++) {
        if (cancelRef.current) break;
        const moduleId = moduleIds[mi];
        if (!moduleId) {
          setModuleStatuses((arr) => arr.map((s, i) => (i === mi ? "skipped" : s)));
          continue;
        }
        setModuleStatuses((arr) => arr.map((s, i) => (i === mi ? "in_progress" : s)));
        setProgressMsg(`Generando módulo ${mi + 1} de ${totalModules}: ${outline.modules[mi].title}`);
        const modRes = await supabase.functions.invoke("generate-course", {
          body: {
            mode: "materialize_module",
            companyId: profile.company_id,
            userId: user.id,
            brief,
            outline,
            moduleId,
            moduleIndex: mi,
          },
        });
        if (modRes.error || modRes.data?.error) {
          console.error("Module failed:", mi, modRes.error || modRes.data?.error);
          setModuleStatuses((arr) => arr.map((s, i) => (i === mi ? "skipped" : s)));
        } else {
          const d = modRes.data || {};
          totalInserted += d.inserted || 0;
          totalSkipped += (d.skipped?.length || 0);
          if (d.deleted) {
            deletedModules += 1;
            setModuleStatuses((arr) => arr.map((s, i) => (i === mi ? "deleted" : s)));
          } else {
            okModules += 1;
            setModuleStatuses((arr) => arr.map((s, i) => (i === mi ? "done" : s)));
          }
        }
        setGenProgress(Math.round(((mi + 1) / totalModules) * 100));
      }

      // 3) Finalize: recompute xp/duration. If nothing was generated, delete the draft.
      if (okModules === 0) {
        await supabase.rpc("delete_draft_course" as any, { _course_id: courseId });
        toast({
          title: "No se pudo generar el curso",
          description: "Ningún módulo produjo contenido válido. Agrega más material y reintentá.",
          variant: "destructive",
        });
        setStep(2);
        return;
      }

      await supabase.functions.invoke("generate-course", {
        body: {
          mode: "materialize_finalize",
          companyId: profile.company_id,
          userId: user.id,
          courseId,
        },
      });

      const summary =
        `${totalInserted} lecciones generadas` +
        (totalSkipped ? ` · ${totalSkipped} omitidas (material insuficiente)` : "") +
        (deletedModules ? ` · ${deletedModules} módulo(s) eliminado(s) por falta de contenido` : "") +
        (cancelRef.current ? " · cancelado por el usuario" : "");
      toast({ title: "¡Curso creado!", description: summary });
      navigate(`/app/admin/courses/${courseId}`);
    } catch (e: any) {
      toast({ title: "Error generando curso", description: e.message, variant: "destructive" });
      // If we created a course shell but everything failed, clean it up.
      if (courseId) {
        try { await supabase.rpc("delete_draft_course" as any, { _course_id: courseId }); } catch {}
      }
      setStep(2);
    } finally {
      setLoading(false);
      setProgressMsg("");
    }
  };

  const cancelGeneration = () => {
    cancelRef.current = true;
    toast({ title: "Cancelando…", description: "Se detendrá tras el módulo actual." });
  };

  // ----- Render -----
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/app/admin/courses")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> Course Studio
          </h1>
          <p className="text-muted-foreground text-sm">Genera cursos profesionales desde múltiples fuentes.</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                  ? "bg-primary/20 text-primary border-2 border-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-sm font-medium ${i === step ? "text-foreground" : "text-muted-foreground"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* STEP 0: SOURCES */}
          {step === 0 && (
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Título del curso *</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Política de seguridad 2025" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nivel</Label>
                    <Select value={level} onValueChange={(v: any) => setLevel(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Principiante</SelectItem>
                        <SelectItem value="intermediate">Intermedio</SelectItem>
                        <SelectItem value="advanced">Avanzado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notas para la IA (opcional)</Label>
                  <Textarea
                    value={userNotes}
                    onChange={(e) => setUserNotes(e.target.value)}
                    placeholder="Ej: enfócate en compliance, ignora la sección de RRHH, usa ejemplos del sector retail…"
                    rows={2}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <SourceUploader icon={FileText} label="PDF (máx 15 MB)" accept="application/pdf" multiple onFiles={(f, el) => addFiles(f, "pdf", el)} />
                  <SourceUploader icon={ImageIcon} label="Imágenes / screenshots (máx 8 MB c/u)" accept="image/*" multiple onFiles={(f, el) => addFiles(f, "image", el)} />
                  <SourceUploader icon={SheetIcon} label="Excel / CSV (máx 5 MB)" accept=".xlsx,.xls,.csv" multiple onFiles={(f, el) => addExcel(f, el)} />
                  <div className="border border-dashed border-border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Link2 className="w-4 h-4" /> URL externa
                    </div>
                    <div className="flex gap-2">
                      <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://…" />
                      <Button type="button" onClick={addUrl} disabled={loading || !urlInput.trim()}>
                        Agregar
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border border-dashed border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Type className="w-4 h-4" /> Texto / Markdown pegado
                  </div>
                  <Textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} rows={4} placeholder="Pega aquí cualquier texto fuente…" />
                  <Button type="button" variant="secondary" size="sm" onClick={addText} disabled={!textInput.trim()}>
                    Agregar texto
                  </Button>
                </div>

                {sources.length > 0 && (
                  <div className="space-y-2">
                    <Label>Fuentes agregadas ({sources.length})</Label>
                    <div className="flex flex-wrap gap-2">
                      {sources.map((s) => (
                        <Badge key={s.id} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
                          {s.kind.toUpperCase()} · {s.name.slice(0, 40)}
                          <button onClick={() => removeSource(s.id)} className="hover:bg-muted rounded p-0.5">
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* STEP 1: BRIEF */}
          {step === 1 && brief && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">Tema: {brief.topic}</h3>
                  <p className="text-muted-foreground text-sm mt-1">{brief.summary}</p>
                </div>

                {briefRichness === 0 && (
                  <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-3 flex gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <strong>Material insuficiente.</strong> No se detectaron conceptos, hechos ni procedimientos. Volvé al paso anterior y agregá más fuentes para evitar un curso vacío.
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{brief.key_concepts?.length || 0} conceptos</Badge>
                  <Badge variant="outline">{brief.facts?.length || 0} hechos</Badge>
                  <Badge variant="outline">{brief.procedures?.length || 0} procedimientos</Badge>
                  <Badge variant="outline">{brief.comparisons?.length || 0} comparaciones</Badge>
                </div>

                {brief.key_concepts?.length > 0 && (
                  <div>
                    <Label className="text-sm">Conceptos clave</Label>
                    <div className="grid md:grid-cols-2 gap-2 mt-2">
                      {brief.key_concepts.slice(0, 8).map((c: any, i: number) => (
                        <div key={i} className="border border-border rounded p-2 text-sm">
                          <strong>{c.term}</strong>
                          <p className="text-muted-foreground text-xs">{c.definition}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {brief.procedures?.length > 0 && (
                  <div>
                    <Label className="text-sm">Procedimientos detectados</Label>
                    <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                      {brief.procedures.slice(0, 5).map((p: any, i: number) => (
                        <li key={i}>{p.title} ({p.steps?.length || 0} pasos)</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-2 pt-4 border-t">
                  <Label>Notas adicionales para el outline (opcional)</Label>
                  <Textarea value={userNotes} onChange={(e) => setUserNotes(e.target.value)} rows={2} placeholder="Ej: dale más peso al módulo de cumplimiento…" />
                  <p className="text-xs text-muted-foreground">Estas notas se aplicarán al diseñar la estructura del curso.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 2: OUTLINE */}
          {step === 2 && outline && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-muted-foreground text-sm">{outline.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {outline.modules?.length || 0} módulos · ~{outline.estimated_duration_minutes || 30} min
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={runOutline} disabled={loading}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Regenerar outline
                  </Button>
                </div>

                {!outlineValid && (
                  <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-3 flex gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <span>Cada módulo debe tener al menos una lección antes de generar el curso.</span>
                  </div>
                )}

                <div className="space-y-3">
                  {outline.modules?.map((m: any, mi: number) => (
                    <div key={mi} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{mi + 1}</span>
                        <Input
                          value={m.title}
                          onChange={(e) => updateModule(mi, { title: e.target.value })}
                          className="font-semibold flex-1"
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveModule(mi, -1)} disabled={mi === 0}>
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveModule(mi, 1)} disabled={mi === outline.modules.length - 1}>
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeModule(mi)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="space-y-1.5 pl-6">
                        {m.lessons?.map((l: any, li: number) => {
                          const Icon = TYPE_ICON[l.lesson_type] || BookOpen;
                          return (
                            <div key={li} className="flex items-center gap-2">
                              <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <Input
                                value={l.title}
                                onChange={(e) => updateLesson(mi, li, { title: e.target.value })}
                                className="h-8 text-sm flex-1"
                              />
                              <Select
                                value={l.lesson_type}
                                onValueChange={(v) => updateLesson(mi, li, { lesson_type: v })}
                              >
                                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(TYPE_LABEL).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveLesson(mi, li, -1)} disabled={li === 0}>
                                <ArrowUp className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveLesson(mi, li, 1)} disabled={li === (m.lessons?.length || 0) - 1}>
                                <ArrowDown className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeLesson(mi, li)}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          );
                        })}
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addLesson(mi)}>
                          <Plus className="w-3 h-3 mr-1" /> Agregar lección
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 3: GENERATE */}
          {step === 3 && (
            <Card>
              <CardContent className="p-8 space-y-5">
                <div className="text-center space-y-3">
                  <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
                  <h3 className="font-semibold text-lg">Materializando el curso…</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">{progressMsg}</p>
                  <Progress value={genProgress} className="max-w-md mx-auto" />
                  <p className="text-xs text-muted-foreground">{genProgress}% completado</p>
                </div>

                {moduleStatuses.length > 0 && (
                  <div className="space-y-1.5 max-w-md mx-auto">
                    {outline?.modules?.map((m: any, mi: number) => {
                      const st = moduleStatuses[mi];
                      const icon =
                        st === "done" ? <Check className="w-3.5 h-3.5 text-primary" /> :
                        st === "in_progress" ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> :
                        st === "skipped" ? <X className="w-3.5 h-3.5 text-destructive" /> :
                        st === "deleted" ? <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" /> :
                        <div className="w-3.5 h-3.5 rounded-full border border-border" />;
                      return (
                        <div key={mi} className="flex items-center gap-2 text-sm">
                          {icon}
                          <span className={st === "deleted" || st === "skipped" ? "text-muted-foreground line-through" : ""}>
                            {mi + 1}. {m.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {loading && (
                  <div className="flex justify-center">
                    <Button variant="outline" size="sm" onClick={cancelGeneration} disabled={cancelRef.current}>
                      Cancelar generación
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer actions */}
      {step < 3 && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || loading}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
          </Button>

          {progressMsg && (
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> {progressMsg}
            </span>
          )}

          {step === 0 && (
            <Button onClick={runExtract} disabled={!canNext || loading} className="gradient-primary shadow-primary">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Extraer conocimiento
            </Button>
          )}
          {step === 1 && (
            <Button onClick={runOutline} disabled={!canNext || loading} className="gradient-primary shadow-primary">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
              Diseñar outline
            </Button>
          )}
          {step === 2 && (
            <Button onClick={runMaterialize} disabled={!canNext || loading} className="gradient-primary shadow-primary">
              <Sparkles className="w-4 h-4 mr-2" /> Generar curso completo
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ----- Reusable uploader tile -----
function SourceUploader({
  icon: Icon, label, accept, multiple, onFiles,
}: {
  icon: any; label: string; accept: string; multiple?: boolean;
  onFiles: (files: FileList | null, inputEl: HTMLInputElement) => void;
}) {
  return (
    <label className="border border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary hover:bg-muted/40 transition-colors flex items-center gap-3">
      <Icon className="w-5 h-5 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Upload className="w-3 h-3" /> Click para seleccionar
        </div>
      </div>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => onFiles(e.target.files, e.currentTarget)}
      />
    </label>
  );
}
