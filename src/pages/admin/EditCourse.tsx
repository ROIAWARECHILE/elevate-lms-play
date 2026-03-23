import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, PlusCircle, GripVertical, Trash2, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Module {
  id: string;
  title: string;
  description: string;
  sort_order: number;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  content_type: string;
  content: any;
  sort_order: number;
}

export default function EditCourse() {
  const { courseId } = useParams();
  const { toast } = useToast();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const [courseRes, modulesRes] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).single(),
      supabase.from("modules").select("*, lessons(*)").eq("course_id", courseId).order("sort_order"),
    ]);
    if (courseRes.data) setCourse(courseRes.data);
    if (modulesRes.data) {
      setModules(
        (modulesRes.data as any[]).map((m) => ({
          ...m,
          lessons: (m.lessons || []).sort((a: Lesson, b: Lesson) => a.sort_order - b.sort_order),
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [courseId]);

  const addModule = async () => {
    const { data, error } = await supabase
      .from("modules")
      .insert({
        course_id: courseId!,
        title: `Módulo ${modules.length + 1}`,
        sort_order: modules.length,
      })
      .select()
      .single();
    if (data) {
      setModules([...modules, { ...data, lessons: [] } as Module]);
      toast({ title: "Módulo agregado" });
    }
  };

  const addLesson = async (moduleId: string, moduleIndex: number) => {
    const lessonCount = modules[moduleIndex].lessons.length;
    const { data, error } = await supabase
      .from("lessons")
      .insert({
        module_id: moduleId,
        title: `Lección ${lessonCount + 1}`,
        content_type: "text",
        content: { text: "" },
        sort_order: lessonCount,
      })
      .select()
      .single();
    if (data) {
      const updated = [...modules];
      updated[moduleIndex].lessons.push(data as Lesson);
      setModules(updated);
      toast({ title: "Lección agregada" });
    }
  };

  const updateLesson = async (lessonId: string, title: string, content: string, moduleIndex: number, lessonIndex: number) => {
    await supabase
      .from("lessons")
      .update({ title, content: { text: content } })
      .eq("id", lessonId);
    const updated = [...modules];
    updated[moduleIndex].lessons[lessonIndex] = {
      ...updated[moduleIndex].lessons[lessonIndex],
      title,
      content: { text: content },
    };
    setModules(updated);
  };

  const deleteLesson = async (lessonId: string, moduleIndex: number, lessonIndex: number) => {
    await supabase.from("lessons").delete().eq("id", lessonId);
    const updated = [...modules];
    updated[moduleIndex].lessons.splice(lessonIndex, 1);
    setModules(updated);
    toast({ title: "Lección eliminada" });
  };

  const deleteModule = async (moduleId: string, moduleIndex: number) => {
    await supabase.from("modules").delete().eq("id", moduleId);
    const updated = [...modules];
    updated.splice(moduleIndex, 1);
    setModules(updated);
    toast({ title: "Módulo eliminado" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        to="/app/admin/courses"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a cursos
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{course?.title}</h1>
        <p className="text-muted-foreground text-sm">{course?.description}</p>
      </div>

      {/* Modules */}
      <div className="space-y-4">
        {modules.map((mod, mi) => (
          <Card key={mod.id} className="shadow-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  {mod.title}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => deleteModule(mod.id, mi)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {mod.lessons.map((lesson, li) => (
                <div key={lesson.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={lesson.title}
                      onChange={(e) => updateLesson(lesson.id, e.target.value, lesson.content?.text || "", mi, li)}
                      className="font-medium"
                      placeholder="Título de la lección"
                    />
                    <Button variant="ghost" size="icon" onClick={() => deleteLesson(lesson.id, mi, li)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <Textarea
                    value={lesson.content?.text || ""}
                    onChange={(e) => updateLesson(lesson.id, lesson.title, e.target.value, mi, li)}
                    placeholder="Contenido de la lección..."
                    rows={3}
                  />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addLesson(mod.id, mi)}>
                <PlusCircle className="w-4 h-4 mr-1" /> Agregar lección
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="outline" onClick={addModule} className="w-full">
        <PlusCircle className="w-4 h-4 mr-2" /> Agregar módulo
      </Button>
    </div>
  );
}
