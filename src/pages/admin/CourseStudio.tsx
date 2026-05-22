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
  Database, Globe, Building2, MessageSquare,
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

const SIZE_CAPS: Record<"pdf" | "image" | "excel", number> = {
  pdf: 50 * 1024 * 1024,    // 50 MB — archivos van a Storage, no como base64 en payload
  image: 20 * 1024 * 1024,  // 20 MB
  excel: 10 * 1024 * 1024,  // 10 MB — procesado localmente con XLSX.js
};

const TYPE_ICON: Record<string, any> = {
  reading: BookOpen, concept: Lightbulb, flashcards: Layers, steps: ListOrdered,
  comparison: Columns3, case_study: Briefcase, interactive_quiz: Brain,
  sop_walkthrough: ListOrdered, client_chat: MessageSquare,
};
const TYPE_LABEL: Record<string, string> = {
  reading: "Lectura", concept: "Conceptos", flashcards: "Tarjetas", steps: "Pasos",
  comparison: "Comparativa", case_study: "Caso", interactive_quiz: "Quiz",
  sop_walkthrough: "Procedimiento", client_chat: "Chat cliente",
};

type ModuleStatus = "pending" | "in_progress" | "done" | "skipped" | "deleted";

function isValidBrief(brief: any): boolean {
  if (!brief || typeof brief !== "object") return false;
  return Array.isArray(brief.key_concepts) && brief.key_concepts.length > 0;
}

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

async function uploadToStorage(
  file: File,
  userId: string,
): Promise<{ storagePath: string; signedUrl: string }> {
  const ext = file.name.split(".").pop() || "bin";
  const storagePath = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: upErr } = await supabase.storage
    .from("course-uploads")
    .upload(storagePath, file, { upsert: false });
  if (upErr) throw new Error(`Error al subir archivo: ${upErr.message}`);
  const { data: signedData, error: signErr } = await supabase.storage
    .from("course-uploads")
    .createSignedUrl(storagePath, 600); // 10 minutos
  if (signErr || !signedData?.signedUrl) throw new Error("No se pudo generar URL firmada");
  return { storagePath, signedUrl: signedData.signedUrl };
}

function humanizeUrlError(raw: string): string {
  if (raw.includes("abort") || raw.includes("timeout") || raw.includes("25s"))
    return "El sitio tardó demasiado en responder. Intenta con otra URL.";
  if (raw.includes("403") || raw.includes("Forbidden") || raw.includes("bloqueó"))
    return raw.includes("bloqueó") ? raw : "El sitio bloqueó el acceso. Copia el texto manualmente.";
  if (raw.includes("404")) return "Página no encontrada (404). Verifica la URL.";
  if (raw.includes("PDF") || raw.includes("JavaScript") || raw.includes("grande"))
    return raw;
  if (raw.includes("contenido útil")) return raw;
  return `No se pudo obtener el contenido: ${raw}`;
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

  // Blueprint mode state
  const [studioMode, setStudioMode] = useState<"classic" | "blueprint" | null>(null);
  const [bpStep, setBpStep] = useState(0);
  const [bpSourceId, setBpSourceId] = useState("");
  const [bpBlueprintId, setBpBlueprintId] = useState("");
  const [bpBlueprintData, setBpBlueprintData] = useState<any>(null);
  const [bpVariables, setBpVariables] = useState<Record<string, string>>({});
  const [bpLibrarySources, setBpLibrarySources] = useState<any[]>([]);
  const [bpLibraryBlueprints, setBpLibraryBlueprints] = useState<any[]>([]);

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
    if (!files || !user) return;
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
        // 1. Subir a Storage (binario directo, sin base64)
        setProgressMsg(`Subiendo ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)…`);
        const { storagePath, signedUrl } = await uploadToStorage(f, user.id);

        // 2. Parsear con LlamaParse pasando la URL firmada
        setProgressMsg(`Parseando ${f.name} con LlamaParse…`);
        try {
          const { data, error } = await supabase.functions.invoke("parse-source", {
            body: { kind, name: f.name, storageUrl: signedUrl, storagePath },
          });
          if (error || data?.error) throw new Error(data?.error || error?.message || "parse failed");
          const md = String(data?.markdown || "").trim();
          if (md.length > 50) {
            next.push({
              id: crypto.randomUUID(),
              kind: "text",
              name: f.name,
              payload: md,
              metadata: {
                parser: "llamaparse",
                original_kind: kind,
                job_id: data.job_id,
                pages: data.pages,
                stats: data.stats,
              },
            });
            continue;
          }
          throw new Error("markdown vacío");
        } catch (parseErr: any) {
          console.warn("LlamaParse falló:", parseErr?.message);
          if (kind === "image") {
            // Fallback a modo visión para imágenes: leer localmente como base64
            toast({ title: "Parseado básico", description: `${f.name}: usando modo visión.` });
            const payload = await fileToBase64(f);
            next.push({ id: crypto.randomUUID(), kind, name: f.name, payload });
          } else {
            // Para PDFs no hay fallback útil
            toast({
              title: "Error al parsear",
              description: `${f.name}: ${parseErr?.message || "LlamaParse no disponible"}`,
              variant: "destructive",
            });
          }
        }
      } catch (err: any) {
        toast({ title: "Error", description: err?.message || `No se pudo procesar ${f.name}`, variant: "destructive" });
      }
    }
    setProgressMsg("");
    if (next.length) {
      setSources((s) => [...s, ...next]);
      const parsed = next.filter((n) => n.metadata?.parser === "llamaparse").length;
      toast({
        title: "Fuente añadida",
        description: `${next.length} archivo(s) cargados${parsed ? ` · ${parsed} parseado(s) con LlamaParse` : ""}.`,
      });
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
      const words = data.wordCount ?? Math.round((data.text?.split(/\s+/).filter(Boolean).length || 0));
      toast({ title: "URL añadida", description: `${data.title || u} · ~${words.toLocaleString()} palabras extraídas` });
    } catch (e: any) {
      toast({ title: "No se pudo cargar la URL", description: humanizeUrlError(e.message), variant: "destructive" });
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
    if (!isValidBrief(brief)) {
      toast({
        title: "Brief sin estructura válida",
        description: "No se detectaron conceptos clave. Vuelve al paso anterior y agrega más material.",
        variant: "destructive",
      });
      return;
    }
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
    const pauseForAiQuota = () => new Promise((resolve) => setTimeout(resolve, 2000));

    // Progreso granular: contar lecciones + quizzes + 2 (init + finalize) como unidades
    const totalLessons = outline.modules?.reduce((sum: number, m: any) => sum + (m.lessons?.length || 0), 0) || 0;
    const totalUnits = totalLessons + totalModules + 2;
    let completedUnits = 1; // init completado

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

      // 2) Materialize each module: one lesson per request, then quiz.
      let totalSkipped = 0;
      let totalInserted = 0;
      let okModules = 0;
      let deletedModules = 0;
      const failures: { module: string; lesson: string; reason: string }[] = [];
      for (let mi = 0; mi < totalModules; mi++) {
        if (cancelRef.current) break;
        const moduleId = moduleIds[mi];
        if (!moduleId) {
          setModuleStatuses((arr) => arr.map((s, i) => (i === mi ? "skipped" : s)));
          continue;
        }
        setModuleStatuses((arr) => arr.map((s, i) => (i === mi ? "in_progress" : s)));
        const mod = outline.modules[mi];
        const lessons = mod.lessons || [];
        let moduleInserted = 0;
        let moduleSkipped = 0;

        // 2a) One request per lesson (keeps each call well under 150s).
        for (let li = 0; li < lessons.length; li++) {
          if (cancelRef.current) break;
          setProgressMsg(
            `Módulo ${mi + 1}/${totalModules} · Lección ${li + 1}/${lessons.length}: ${lessons[li].title}`,
          );
          const lessonRes = await supabase.functions.invoke("generate-course", {
            body: {
              mode: "materialize_lesson",
              companyId: profile.company_id,
              userId: user.id,
              brief,
              outline,
              moduleId,
              moduleIndex: mi,
              lessonIndex: li,
              sortOrder: moduleInserted,
            },
          });
          if (lessonRes.error || lessonRes.data?.error) {
            const reason = lessonRes.data?.error || lessonRes.error?.message || "error desconocido";
            console.warn("Lesson failed (skip):", mi, li, reason);
            failures.push({ module: mod.title, lesson: lessons[li].title, reason });
            moduleSkipped += 1;
          } else {
            const d = lessonRes.data || {};
            if (d.inserted) {
              moduleInserted += 1;
            } else {
              failures.push({ module: mod.title, lesson: lessons[li].title, reason: d.reason || "sin bloques válidos" });
              moduleSkipped += 1;
            }
          }
          completedUnits += 1;
          setGenProgress(Math.max(5, Math.round((completedUnits / totalUnits) * 100)));
          if (!cancelRef.current && (li < lessons.length - 1 || mi < totalModules - 1)) {
            setProgressMsg(`Pausando unos segundos para respetar la cuota de IA…`);
            await pauseForAiQuota();
          }
        }

        if (cancelRef.current) break;

        // 2b) Quiz for the module (or delete shell if no lessons survived).
        setProgressMsg(`Pausando unos segundos antes de generar la evaluación…`);
        await pauseForAiQuota();
        setProgressMsg(`Módulo ${mi + 1}/${totalModules}: generando evaluación…`);
        let qd: any = {};
        try {
          const quizRes = await supabase.functions.invoke("generate-course", {
            body: {
              mode: "materialize_module_quiz",
              companyId: profile.company_id,
              userId: user.id,
              brief,
              outline,
              moduleId,
              moduleIndex: mi,
            },
          });
          if (quizRes.error || quizRes.data?.error) {
            console.warn("Quiz failed (skip):", quizRes.data?.error || quizRes.error?.message);
          } else {
            qd = quizRes.data || {};
          }
        } catch (e: any) {
          console.warn("Quiz exception:", e?.message);
        }
        completedUnits += 1;
        setGenProgress(Math.max(5, Math.round((completedUnits / totalUnits) * 100)));
        totalInserted += moduleInserted;
        totalSkipped += moduleSkipped;
        if (qd.deleted || moduleInserted === 0) {
          deletedModules += 1;
          setModuleStatuses((arr) => arr.map((s, i) => (i === mi ? "deleted" : s)));
        } else {
          okModules += 1;
          setModuleStatuses((arr) => arr.map((s, i) => (i === mi ? "done" : s)));
        }
      }

      // 3) Finalize: recompute xp/duration. If nothing was generated, delete the draft.
      if (okModules === 0) {
        await supabase.rpc("delete_draft_course" as any, { _course_id: courseId });
        const sample = failures.slice(0, 3).map((f) => `• ${f.lesson}: ${f.reason}`).join("\n");
        toast({
          title: "No se pudo generar el curso",
          description: `Ningún módulo produjo contenido válido. Agrega más material y reintentá.${sample ? `\n\nMotivos:\n${sample}` : ""}`,
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
        (totalSkipped ? ` · ${totalSkipped} omitidas` : "") +
        (deletedModules ? ` · ${deletedModules} módulo(s) eliminado(s)` : "") +
        (cancelRef.current ? " · cancelado por el usuario" : "");
      toast({
        title: failures.length ? "Curso creado con advertencias" : "¡Curso creado!",
        description: failures.length
          ? `${summary}. Revisalo y regenerá las lecciones omitidas desde Editar curso.`
          : summary,
      });
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

  // ----- Blueprint Mode helpers -----
  const enterBlueprintMode = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const [srcRes, bpRes] = await Promise.all([
        supabase.from("source_library" as any)
          .select("id, title, source_type, word_count")
          .eq("company_id", profile.company_id)
          .order("created_at", { ascending: false }),
        supabase.from("course_blueprints" as any)
          .select("id, company_id, slug, name, description, category, structure, is_template")
          .or(`company_id.eq.${profile.company_id},company_id.is.null`)
          .order("is_template", { ascending: false })
          .order("name"),
      ]);
      setBpLibrarySources((srcRes.data as any[]) || []);
      setBpLibraryBlueprints((bpRes.data as any[]) || []);
      setStudioMode("blueprint");
      setBpStep(0);
    } catch (e: any) {
      toast({ title: "Error cargando datos", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const substituteVariables = (template: string, vars: Record<string, string>): string =>
    template.replace(/\{(\w+)\}/g, (_, k) => vars[k] || `{${k}}`);

  const runBlueprintGenerate = async () => {
    if (!profile?.company_id || !user?.id || !bpBlueprintData) return;
    const selectedSource = bpLibrarySources.find((s) => s.id === bpSourceId);
    if (!selectedSource) return;

    setLoading(true);
    setProgressMsg("Cargando fuente…");
    try {
      const { data: srcData } = await supabase
        .from("source_library" as any)
        .select("content_md, title")
        .eq("id", bpSourceId)
        .single();
      if (!srcData) throw new Error("No se encontró la fuente seleccionada.");
      const sourceMd = (srcData as any).content_md as string;

      // Construir título a partir del blueprint y variables
      const courseTitle = title.trim() ||
        substituteVariables(bpBlueprintData.structure.modules[0]?.title_template || bpBlueprintData.name, bpVariables);

      // Extraer brief del contenido de la fuente
      setProgressMsg("Extrayendo conocimiento de la fuente…");
      const extractRes = await supabase.functions.invoke("generate-course", {
        body: {
          mode: "extract",
          companyId: profile.company_id,
          userId: user.id,
          sources: [{ kind: "text", name: selectedSource.title, payload: sourceMd.slice(0, 60_000) }],
        },
      });
      if (extractRes.error || extractRes.data?.error)
        throw new Error(extractRes.data?.error || extractRes.error?.message || "Extract failed");
      const extractedBrief = extractRes.data.brief;

      // Construir outline desde el blueprint (sustituyendo variables)
      const blueprintOutline = {
        modules: bpBlueprintData.structure.modules.map((mod: any) => ({
          title: substituteVariables(mod.title_template, bpVariables),
          description: "",
          lessons: mod.lessons.map((les: any) => ({
            title: substituteVariables(les.title_template, bpVariables),
            lessonType: les.lesson_type,
          })),
        })),
      };

      // Alimentar el flujo clásico con los datos generados
      setTitle(courseTitle);
      setBrief(extractedBrief);
      setOutline(blueprintOutline);
      setSources([{ id: crypto.randomUUID(), kind: "text", name: selectedSource.title, payload: sourceMd.slice(0, 60_000) }]);

      // Transicionar al paso de generación del modo clásico
      setStudioMode("classic");
      setStep(3);
      setProgressMsg("");

      // Disparar la generación directamente
      setModuleStatuses(blueprintOutline.modules.map(() => "pending" as const));
      await runMaterialize();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setLoading(false);
      setProgressMsg("");
    }
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

      {/* Selector de modo — solo si no hay modo elegido */}
      {studioMode === null && (
        <div className="grid md:grid-cols-2 gap-4 py-4">
          <Card
            className="cursor-pointer border-2 hover:border-primary transition-all shadow-card hover:shadow-elevated"
            onClick={() => setStudioMode("classic")}
          >
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <p className="font-bold text-lg">Modo clásico</p>
                <p className="text-sm text-muted-foreground">
                  Sube fuentes, Kibbo extrae el conocimiento y diseña la estructura. Máximo control.
                </p>
              </div>
              <Badge variant="secondary">4 pasos guiados</Badge>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer border-2 hover:border-primary transition-all shadow-card hover:shadow-elevated ${loading ? "opacity-50 pointer-events-none" : ""}`}
            onClick={enterBlueprintMode}
          >
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                {loading ? <Loader2 className="w-7 h-7 animate-spin" /> : <Layers className="w-7 h-7" />}
              </div>
              <div>
                <p className="font-bold text-lg">Modo Blueprint</p>
                <p className="text-sm text-muted-foreground">
                  Elige una fuente de tu librería y una plantilla pedagógica. Genera en 1 clic.
                </p>
              </div>
              <Badge variant="secondary">Plantillas predefinidas</Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Blueprint Mode steps */}
      {studioMode === "blueprint" && (
        <div className="space-y-6">
          {/* Blueprint stepper */}
          <div className="flex items-center gap-2">
            {["Fuente", "Blueprint", "Variables", "Generar"].map((label, i) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  i < bpStep ? "bg-primary text-primary-foreground"
                  : i === bpStep ? "bg-primary/20 text-primary border-2 border-primary"
                  : "bg-muted text-muted-foreground"
                }`}>
                  {i < bpStep ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-sm font-medium ${i === bpStep ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                {i < 3 && <div className="flex-1 h-px bg-border" />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={bpStep} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
              {/* BP Step 0: Select source */}
              {bpStep === 0 && (
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <h2 className="font-semibold text-lg mb-1 flex items-center gap-2">
                        <Database className="w-5 h-5 text-primary" /> Elige la fuente de conocimiento
                      </h2>
                      <p className="text-sm text-muted-foreground">Selecciona un documento de tu librería de fuentes.</p>
                    </div>
                    <div className="space-y-2">
                      {bpLibrarySources.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Database className="w-10 h-10 mx-auto mb-2 opacity-30" />
                          <p>No hay fuentes en la librería.</p>
                          <p className="text-xs mt-1">Ve a <strong>Librería de fuentes</strong> para subir documentos.</p>
                        </div>
                      ) : (
                        bpLibrarySources.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => setBpSourceId(s.id)}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-3 ${bpSourceId === s.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                          >
                            <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{s.title}</p>
                              <p className="text-xs text-muted-foreground">{s.source_type?.toUpperCase()} · {s.word_count?.toLocaleString()} palabras</p>
                            </div>
                            {bpSourceId === s.id && <Check className="w-5 h-5 text-primary flex-shrink-0" />}
                          </div>
                        ))
                      )}
                    </div>
                    <div className="space-y-2 pt-2">
                      <Label>Título del curso (opcional)</Label>
                      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Se generará automáticamente si no lo escribes" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* BP Step 1: Select blueprint */}
              {bpStep === 1 && (
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <h2 className="font-semibold text-lg mb-1 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-primary" /> Elige el blueprint pedagógico
                      </h2>
                      <p className="text-sm text-muted-foreground">La estructura del curso seguirá exactamente esta plantilla.</p>
                    </div>
                    <div className="space-y-2">
                      {bpLibraryBlueprints.map((bp) => {
                        const isGlobal = bp.company_id === null;
                        const totalLessons = bp.structure?.modules?.reduce((acc: number, m: any) => acc + (m.lessons?.length || 0), 0) || 0;
                        return (
                          <div
                            key={bp.id}
                            onClick={() => { setBpBlueprintId(bp.id); setBpBlueprintData(bp); setBpVariables({}); }}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex items-start gap-3 ${bpBlueprintId === bp.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                              {isGlobal ? <Globe className="w-4 h-4 text-muted-foreground" /> : <Building2 className="w-4 h-4 text-muted-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{bp.name}</p>
                              <p className="text-xs text-muted-foreground">{bp.structure?.modules?.length || 0} módulos · {totalLessons} lecciones</p>
                              {bp.description && <p className="text-xs text-muted-foreground mt-0.5">{bp.description}</p>}
                            </div>
                            {bpBlueprintId === bp.id && <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* BP Step 2: Fill variables */}
              {bpStep === 2 && bpBlueprintData && (
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <h2 className="font-semibold text-lg mb-1">Configura las variables</h2>
                      <p className="text-sm text-muted-foreground">
                        Estas variables se sustituirán en todos los títulos del blueprint.
                      </p>
                    </div>
                    {(bpBlueprintData.structure?.variables || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Este blueprint no tiene variables configurables.</p>
                    ) : (
                      <div className="space-y-3">
                        {(bpBlueprintData.structure.variables as string[]).map((varName) => (
                          <div key={varName}>
                            <Label className="font-mono text-sm">{`{${varName}}`}</Label>
                            <Input
                              className="mt-1"
                              placeholder={`Valor para ${varName}`}
                              value={bpVariables[varName] || ""}
                              onChange={(e) => setBpVariables((v) => ({ ...v, [varName]: e.target.value }))}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                      <p className="font-medium mb-1">Vista previa del primer módulo:</p>
                      <p className="font-mono">
                        {substituteVariables(bpBlueprintData.structure.modules[0]?.title_template || "", bpVariables)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Blueprint footer */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => bpStep > 0 ? setBpStep((s) => s - 1) : setStudioMode(null)} disabled={loading}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
            </Button>
            {progressMsg && (
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> {progressMsg}
              </span>
            )}
            {bpStep < 2 && (
              <Button
                onClick={() => setBpStep((s) => s + 1)}
                disabled={bpStep === 0 ? !bpSourceId : !bpBlueprintId}
                className="gradient-primary shadow-primary"
              >
                Siguiente <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            {bpStep === 2 && (
              <Button
                onClick={runBlueprintGenerate}
                disabled={loading}
                className="gradient-primary shadow-primary"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Generar curso
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Stepper — solo en modo clásico */}
      {studioMode === "classic" && <div className="flex items-center justify-between gap-2">
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
      </div>}

      {studioMode === "classic" && <AnimatePresence mode="wait">
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
                  <p className="text-xs text-muted-foreground">
                    {genProgress > 0 ? `${genProgress}% completado` : "Iniciando…"}
                  </p>
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
      </AnimatePresence>}

      {/* Footer actions */}
      {studioMode === "classic" && step < 3 && (
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
