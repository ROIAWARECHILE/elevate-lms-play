import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";
import {
  Database, FileText, Link2, Type, Plus, Trash2, Loader2, Upload, BookOpen,
} from "lucide-react";
import * as XLSX from "xlsx";

interface SourceItem {
  id: string;
  title: string;
  source_type: string;
  raw_url: string | null;
  word_count: number | null;
  created_at: string;
}

type AddMode = "pdf" | "url" | "text";

const SOURCE_LABELS: Record<string, string> = {
  pdf: "PDF", url: "URL", markdown: "Markdown", docx: "DOCX", text: "Texto",
};

const SIZE_CAP_PDF = 50 * 1024 * 1024;

async function uploadToStorage(file: File, userId: string) {
  const storagePath = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: upErr } = await supabase.storage.from("course-uploads").upload(storagePath, file, { upsert: false });
  if (upErr) throw new Error(`Error al subir: ${upErr.message}`);
  const { data, error: signErr } = await supabase.storage.from("course-uploads").createSignedUrl(storagePath, 600);
  if (signErr || !data?.signedUrl) throw new Error("No se pudo generar URL firmada");
  return { storagePath, signedUrl: data.signedUrl };
}

function countWords(md: string): number {
  return md.trim().split(/\s+/).filter(Boolean).length;
}

export default function SourceLibrary() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("pdf");
  const [saving, setSaving] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchSources = async () => {
    if (!profile?.company_id) return;
    const { data } = await supabase
      .from("source_library" as any)
      .select("id, title, source_type, raw_url, word_count, created_at")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });
    if (data) setSources(data as SourceItem[]);
    setLoading(false);
  };

  useEffect(() => { fetchSources(); }, [profile?.company_id]);

  const resetForm = () => {
    setTitleInput("");
    setUrlInput("");
    setTextInput("");
    setAddMode("pdf");
    setSaving(false);
  };

  const handleSavePDF = async (file: File) => {
    if (!profile?.company_id || !user) return;
    if (file.size > SIZE_CAP_PDF) {
      toast({ title: "Archivo muy grande", description: "Máximo 50 MB.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { storagePath, signedUrl } = await uploadToStorage(file, user.id);
      const { data, error } = await supabase.functions.invoke("parse-source", {
        body: { kind: "pdf", name: file.name, storageUrl: signedUrl, storagePath },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Parse failed");
      const md = String(data?.markdown || "").trim();
      if (!md) throw new Error("No se pudo extraer texto del PDF.");
      const title = titleInput.trim() || file.name.replace(/\.pdf$/i, "");
      const checksum = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(md))
        .then((b) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join(""));
      await supabase.from("source_library" as any).insert({
        company_id: profile.company_id,
        title,
        source_type: "pdf",
        raw_url: storagePath,
        content_md: md,
        content_checksum: checksum,
        word_count: countWords(md),
        created_by: user.id,
      });
      toast({ title: "Fuente guardada", description: `${countWords(md).toLocaleString()} palabras extraídas.` });
      fetchSources();
      setShowAdd(false);
      resetForm();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveURL = async () => {
    if (!profile?.company_id || !user) return;
    const u = urlInput.trim();
    if (!u) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-source", { body: { url: u } });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Fetch failed");
      const md = String(data?.markdown || data?.text || "").trim();
      if (!md) throw new Error("No se pudo obtener contenido de la URL.");
      const title = titleInput.trim() || u;
      const checksum = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(md))
        .then((b) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join(""));
      await supabase.from("source_library" as any).insert({
        company_id: profile.company_id,
        title,
        source_type: "url",
        raw_url: u,
        content_md: md,
        content_checksum: checksum,
        word_count: countWords(md),
        created_by: user.id,
      });
      toast({ title: "Fuente guardada", description: `${countWords(md).toLocaleString()} palabras extraídas.` });
      fetchSources();
      setShowAdd(false);
      resetForm();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveText = async () => {
    if (!profile?.company_id || !user) return;
    const md = textInput.trim();
    if (!md) return;
    const title = titleInput.trim() || "Fuente de texto";
    setSaving(true);
    try {
      const checksum = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(md))
        .then((b) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join(""));
      await supabase.from("source_library" as any).insert({
        company_id: profile.company_id,
        title,
        source_type: "text",
        raw_url: null,
        content_md: md,
        content_checksum: checksum,
        word_count: countWords(md),
        created_by: user.id,
      });
      toast({ title: "Fuente guardada" });
      fetchSources();
      setShowAdd(false);
      resetForm();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("source_library" as any).delete().eq("id", deleteId);
    if (error) { toast({ title: "Error al eliminar", variant: "destructive" }); }
    else { setSources((s) => s.filter((x) => x.id !== deleteId)); }
    setDeleteId(null);
  };

  const typeIcon = (t: string) => {
    if (t === "url") return <Link2 className="w-5 h-5" />;
    if (t === "text" || t === "markdown") return <Type className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" /> Librería de fuentes
          </h1>
          <p className="text-muted-foreground">
            Sube el conocimiento de tu empresa una vez y reutilízalo en cualquier curso.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gradient-primary shadow-primary">
          <Plus className="w-4 h-4 mr-2" /> Nueva fuente
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Card key={i} className="h-16 animate-pulse bg-muted" />)}
        </div>
      ) : sources.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="py-16 text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="font-semibold text-lg mb-2">No hay fuentes aún</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Sube un PDF, pega una URL o escribe texto para alimentar la generación de cursos.
            </p>
            <Button onClick={() => setShowAdd(true)} className="gradient-primary shadow-primary">
              <Plus className="w-4 h-4 mr-2" /> Nueva fuente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sources.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="shadow-card hover:shadow-elevated transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    {typeIcon(s.source_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{s.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {SOURCE_LABELS[s.source_type] || s.source_type}
                      </Badge>
                      {s.word_count != null && (
                        <span className="text-xs text-muted-foreground">
                          {s.word_count.toLocaleString()} palabras
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString("es-CL")}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(s.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Dialog: agregar fuente */}
      <Dialog open={showAdd} onOpenChange={(o) => { if (!saving) { setShowAdd(o); if (!o) resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva fuente de conocimiento</DialogTitle>
          </DialogHeader>

          {/* Selector de tipo */}
          <div className="flex gap-2">
            {(["pdf", "url", "text"] as AddMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setAddMode(m)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                  addMode === m
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "pdf" ? "PDF" : m === "url" ? "URL" : "Texto"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <Label>Título (opcional)</Label>
              <Input
                placeholder="Ej: Catálogo de productos Q1 2026"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
              />
            </div>

            {addMode === "pdf" && (
              <div>
                <Label>Archivo PDF</Label>
                <input
                  type="file"
                  accept=".pdf"
                  ref={fileRef}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleSavePDF(f);
                  }}
                />
                <div
                  className="mt-1 border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Haz clic para seleccionar un PDF (máx. 50 MB)
                  </p>
                </div>
              </div>
            )}

            {addMode === "url" && (
              <div>
                <Label>URL</Label>
                <Input
                  type="url"
                  placeholder="https://…"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
              </div>
            )}

            {addMode === "text" && (
              <div>
                <Label>Contenido</Label>
                <Textarea
                  placeholder="Pega aquí el texto o markdown de tu fuente…"
                  rows={8}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowAdd(false); resetForm(); }} disabled={saving}>
              Cancelar
            </Button>
            {addMode !== "pdf" && (
              <Button
                onClick={addMode === "url" ? handleSaveURL : handleSaveText}
                disabled={saving || (addMode === "url" ? !urlInput.trim() : !textInput.trim())}
                className="gradient-primary"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                {saving ? "Procesando…" : "Guardar fuente"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta fuente?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
