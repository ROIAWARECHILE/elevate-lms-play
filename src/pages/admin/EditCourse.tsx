import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, PlusCircle, GripVertical, Trash2, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Question {
  id?: string;
  question_text: string;
  question_type: "multiple_choice" | "true_false";
  options: string[];
  correct_answer: string;
  sort_order: number;
}

interface Quiz {
  id: string;
  title: string;
  passing_score: number;
  max_attempts: number;
  xp_reward: number;
  questions: Question[];
}

interface Lesson {
  id: string;
  title: string;
  content_type: string;
  content: any;
  sort_order: number;
}

interface Module {
  id: string;
  title: string;
  description: string;
  sort_order: number;
  lessons: Lesson[];
  quiz?: Quiz | null;
}

export default function EditCourse() {
  const { courseId } = useParams();
  const { toast } = useToast();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [courseRes, modulesRes] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).single(),
      supabase.from("modules").select("*, lessons(*), quizzes(*, questions(*))").eq("course_id", courseId).order("sort_order"),
    ]);
    if (courseRes.data) setCourse(courseRes.data);
    if (modulesRes.data) {
      setModules(
        (modulesRes.data as any[]).map((m) => {
          const quizRaw = m.quizzes?.[0] || null;
          return {
            ...m,
            lessons: (m.lessons || []).sort((a: Lesson, b: Lesson) => a.sort_order - b.sort_order),
            quiz: quizRaw
              ? {
                  ...quizRaw,
                  questions: (quizRaw.questions || []).sort((a: Question, b: Question) => a.sort_order - b.sort_order),
                }
              : null,
          };
        })
      );
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [courseId]);

  const addModule = async () => {
    const { data } = await supabase
      .from("modules")
      .insert({ course_id: courseId!, title: `Módulo ${modules.length + 1}`, sort_order: modules.length })
      .select()
      .single();
    if (data) {
      setModules([...modules, { ...data, lessons: [], quiz: null } as Module]);
      toast({ title: "Módulo agregado" });
    }
  };

  const addLesson = async (moduleId: string, mi: number) => {
    const count = modules[mi].lessons.length;
    const { data } = await supabase
      .from("lessons")
      .insert({ module_id: moduleId, title: `Lección ${count + 1}`, content_type: "text", content: { text: "" }, sort_order: count })
      .select()
      .single();
    if (data) {
      const updated = [...modules];
      updated[mi].lessons.push(data as Lesson);
      setModules(updated);
      toast({ title: "Lección agregada" });
    }
  };

  const updateLesson = async (lessonId: string, title: string, content: string, mi: number, li: number) => {
    await supabase.from("lessons").update({ title, content: { text: content } }).eq("id", lessonId);
    const updated = [...modules];
    updated[mi].lessons[li] = { ...updated[mi].lessons[li], title, content: { text: content } };
    setModules(updated);
  };

  const deleteLesson = async (lessonId: string, mi: number, li: number) => {
    await supabase.from("lessons").delete().eq("id", lessonId);
    const updated = [...modules];
    updated[mi].lessons.splice(li, 1);
    setModules(updated);
    toast({ title: "Lección eliminada" });
  };

  const deleteModule = async (moduleId: string, mi: number) => {
    await supabase.from("modules").delete().eq("id", moduleId);
    const updated = [...modules];
    updated.splice(mi, 1);
    setModules(updated);
    toast({ title: "Módulo eliminado" });
  };

  // Quiz management
  const createQuiz = async (moduleId: string, mi: number) => {
    const { data } = await supabase
      .from("quizzes")
      .insert({ module_id: moduleId, title: "Quiz del módulo" })
      .select()
      .single();
    if (data) {
      const updated = [...modules];
      updated[mi].quiz = { ...data, questions: [] } as Quiz;
      setModules(updated);
      toast({ title: "Quiz creado" });
    }
  };

  const deleteQuiz = async (quizId: string, mi: number) => {
    await supabase.from("questions").delete().eq("quiz_id", quizId);
    await supabase.from("quizzes").delete().eq("id", quizId);
    const updated = [...modules];
    updated[mi].quiz = null;
    setModules(updated);
    toast({ title: "Quiz eliminado" });
  };

  const addQuestion = async (quizId: string, mi: number) => {
    const quiz = modules[mi].quiz!;
    const count = quiz.questions.length;
    const { data } = await supabase
      .from("questions")
      .insert({
        quiz_id: quizId,
        question_text: `Pregunta ${count + 1}`,
        question_type: "multiple_choice",
        options: ["Opción A", "Opción B", "Opción C", "Opción D"],
        correct_answer: "Opción A",
        sort_order: count,
      })
      .select()
      .single();
    if (data) {
      const updated = [...modules];
      updated[mi].quiz!.questions.push({ ...data, options: data.options as string[] } as Question);
      setModules(updated);
    }
  };

  const updateQuestion = (mi: number, qi: number, field: string, value: any) => {
    const updated = [...modules];
    const q = updated[mi].quiz!.questions[qi];
    (q as any)[field] = value;
    setModules(updated);
    // debounce save
    const qId = q.id;
    if (qId) {
      supabase.from("questions").update({ [field]: value }).eq("id", qId).then();
    }
  };

  const deleteQuestion = async (questionId: string, mi: number, qi: number) => {
    await supabase.from("questions").delete().eq("id", questionId);
    const updated = [...modules];
    updated[mi].quiz!.questions.splice(qi, 1);
    setModules(updated);
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
              {/* Lessons */}
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

              {/* Quiz Section */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-5 h-5 text-primary" />
                  <h4 className="font-semibold text-sm">Quiz del módulo</h4>
                </div>

                {mod.quiz ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={mod.quiz.title}
                        onChange={(e) => {
                          const updated = [...modules];
                          updated[mi].quiz!.title = e.target.value;
                          setModules(updated);
                          supabase.from("quizzes").update({ title: e.target.value }).eq("id", mod.quiz!.id).then();
                        }}
                        className="font-medium"
                        placeholder="Título del quiz"
                      />
                      <Button variant="ghost" size="icon" onClick={() => deleteQuiz(mod.quiz!.id, mi)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>

                    {/* Questions */}
                    {mod.quiz.questions.map((q, qi) => (
                      <div key={q.id || qi} className="p-3 rounded-lg border space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground w-6">P{qi + 1}</span>
                          <Input
                            value={q.question_text}
                            onChange={(e) => updateQuestion(mi, qi, "question_text", e.target.value)}
                            placeholder="Texto de la pregunta"
                            className="flex-1"
                          />
                          <Select
                            value={q.question_type}
                            onValueChange={(val) => {
                              updateQuestion(mi, qi, "question_type", val);
                              if (val === "true_false") {
                                updateQuestion(mi, qi, "options", ["Verdadero", "Falso"]);
                                updateQuestion(mi, qi, "correct_answer", "Verdadero");
                              } else {
                                updateQuestion(mi, qi, "options", ["Opción A", "Opción B", "Opción C", "Opción D"]);
                                updateQuestion(mi, qi, "correct_answer", "Opción A");
                              }
                            }}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="multiple_choice">Opción múltiple</SelectItem>
                              <SelectItem value="true_false">V/F</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" onClick={() => deleteQuestion(q.id!, mi, qi)}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>

                        {/* Options */}
                        <div className="ml-8 space-y-1">
                          {(q.options || []).map((opt: string, oi: number) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct-${q.id || qi}`}
                                checked={q.correct_answer === opt}
                                onChange={() => updateQuestion(mi, qi, "correct_answer", opt)}
                                className="accent-primary"
                              />
                              {q.question_type === "true_false" ? (
                                <span className="text-sm">{opt}</span>
                              ) : (
                                <Input
                                  value={opt}
                                  onChange={(e) => {
                                    const newOpts = [...q.options];
                                    const wasCorrect = q.correct_answer === newOpts[oi];
                                    newOpts[oi] = e.target.value;
                                    updateQuestion(mi, qi, "options", newOpts);
                                    if (wasCorrect) updateQuestion(mi, qi, "correct_answer", e.target.value);
                                  }}
                                  className="h-8 text-sm"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <Button variant="outline" size="sm" onClick={() => addQuestion(mod.quiz!.id, mi)}>
                      <PlusCircle className="w-4 h-4 mr-1" /> Agregar pregunta
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => createQuiz(mod.id, mi)}>
                    <PlusCircle className="w-4 h-4 mr-1" /> Crear quiz
                  </Button>
                )}
              </div>
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
