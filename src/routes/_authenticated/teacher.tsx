import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { validateTeacherDiplomaFile } from "@/lib/teacher-applications.shared";
import { submitTeacherApplication } from "@/lib/teacher-applications.functions";

type TeacherApplicationRecord = {
  id: string;
  user_id: string;
  diploma_url: string | null;
  status: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

const searchSchema = z.object({
  courseId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/teacher")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Кабинет преподавателя — ОРТ Академия" }] }),
  component: TeacherPage,
});

function TeacherPage() {
  const { user, roles, refreshRoles, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const { courseId } = Route.useSearch();

  const { data: teacherApplication, isLoading: teacherApplicationLoading } = useQuery<TeacherApplicationRecord | null>({
    queryKey: ["teacher-application", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_applications")
        .select("id, user_id, diploma_url, status, rejection_reason, created_at, reviewed_at, reviewed_by")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as TeacherApplicationRecord | null) ?? null;
    },
  });

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("subjects").select("*").order("name")).data ?? [],
  });

  const { data: courses } = useQuery({
    queryKey: ["my-courses", user?.id],
    enabled: !!user && (teacherApplication?.status ?? "") === "approved",
    queryFn: async () => (await supabase.from("courses").select("*, subjects(name)").eq("teacher_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: courseData } = useQuery({
    queryKey: ["course-data", courseId],
    enabled: !!courseId && (teacherApplication?.status ?? "") === "approved",
    queryFn: async () => {
      if (!courseId) return { course: null, lessons: [], tests: [] };
      const [course, lessons, tests] = await Promise.all([
        supabase.from("courses").select("*, subjects(name)").eq("id", courseId).maybeSingle(),
        supabase.from("lessons").select("id, title, order_index, content").eq("course_id", courseId).order("order_index"),
        supabase.from("tests").select("id, title, description").eq("course_id", courseId),
      ]);
      return {
        course: course.data,
        lessons: lessons.data ?? [],
        tests: tests.data ?? [],
      };
    },
  });

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openLesson, setOpenLesson] = useState(false);
  const [openTest, setOpenTest] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [testTitle, setTestTitle] = useState("");
  const [testDesc, setTestDesc] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState<string[]>([""]);
  const [correctIndex, setCorrectIndex] = useState<number>(0);
  // Lesson edit state
  const [openEditLesson, setOpenEditLesson] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState("");
  const [editLessonContent, setEditLessonContent] = useState("");
  const [editLessonFile, setEditLessonFile] = useState<File | null>(null);
  // Test edit state
  const [openEditTest, setOpenEditTest] = useState(false);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [editTestTitle, setEditTestTitle] = useState("");
  const [editTestDesc, setEditTestDesc] = useState("");
  const [testQuestions, setTestQuestions] = useState<any[]>([]);
  // View lesson state
  const [openViewLesson, setOpenViewLesson] = useState(false);
  const [viewLessonTitle, setViewLessonTitle] = useState("");
  const [viewLessonText, setViewLessonText] = useState<string | null>(null);
  const [viewLessonFileName, setViewLessonFileName] = useState<string | null>(null);
  const [viewLessonFileType, setViewLessonFileType] = useState<string | null>(null);
  const [viewLessonDataUrl, setViewLessonDataUrl] = useState<string | null>(null);
  const [reuploadOpen, setReuploadOpen] = useState(false);
  const [reuploadFile, setReuploadFile] = useState<File | null>(null);
  const [reuploadLoading, setReuploadLoading] = useState(false);
  const [newApplicationFile, setNewApplicationFile] = useState<File | null>(null);
  const [newApplicationLoading, setNewApplicationLoading] = useState(false);

  useEffect(() => {
    if (teacherApplication?.status === "approved" && !roles.includes("teacher")) {
      void refreshRoles();
    }
  }, [refreshRoles, roles, teacherApplication?.status]);

  const createCourse = async () => {
    if (!user || !title) return;
    const { error } = await supabase.from("courses").insert({
      title, description: desc || null, subject_id: subjectId || null, teacher_id: user.id, is_published: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Курс создан");
    setOpen(false); setTitle(""); setDesc(""); setSubjectId("");
    qc.invalidateQueries({ queryKey: ["my-courses", user?.id] });
  };

  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSubjectId, setEditSubjectId] = useState<string>("");
  const [editPublished, setEditPublished] = useState<boolean>(true);

  const openEditCourse = (course: any) => {
    setEditingCourseId(course.id);
    setEditTitle(course.title ?? "");
    setEditDesc(course.description ?? "");
    setEditSubjectId(course.subject_id ?? "");
    setEditPublished(Boolean(course.is_published));
    setOpenEdit(true);
  };

  const saveEditCourse = async () => {
    if (!editingCourseId || !editTitle) return;
    const { error } = await supabase.from("courses").update({
      title: editTitle,
      description: editDesc || null,
      subject_id: editSubjectId || null,
      is_published: editPublished,
    }).eq("id", editingCourseId);
    if (error) return toast.error(error.message);
    toast.success("Курс обновлён");
    setOpenEdit(false);
    setEditingCourseId(null);
    setEditTitle("");
    setEditDesc("");
    setEditSubjectId("");
    setEditPublished(true);
    qc.invalidateQueries({ queryKey: ["my-courses", user?.id] });
  };

  const createLesson = async () => {
    if (!courseId || !lessonTitle) return;
    const orderIndex = (courseData?.lessons.length ?? 0) || 0;

    const contentValue = lessonFile
      ? JSON.stringify({
          fileName: lessonFile.name,
          fileType: lessonFile.type,
          fileSize: lessonFile.size,
          dataUrl: await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result;
              if (typeof result === "string") resolve(result);
              else reject(new Error("Ошибка чтения файла"));
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(lessonFile);
          }),
        })
      : lessonContent || "";

    const { error } = await supabase.from("lessons").insert({
      course_id: courseId,
      title: lessonTitle,
      content: contentValue,
      order_index: orderIndex,
    });
    if (error) return toast.error(error.message);
    toast.success("Урок добавлен");
    setOpenLesson(false);
    setLessonTitle("");
    setLessonContent("");
    setLessonFile(null);
    qc.invalidateQueries({ queryKey: ["course-data", courseId] });
  };

  const openEditLessonDialog = (lesson: any) => {
    setEditingLessonId(lesson.id);
    setEditLessonTitle(lesson.title ?? "");
    setEditLessonContent(lesson.content ?? "");
    setEditLessonFile(null);
    setOpenEditLesson(true);
  };

  const saveEditLesson = async () => {
    if (!editingLessonId || !editLessonTitle) return;
    const contentValue = editLessonFile
      ? JSON.stringify({ fileName: editLessonFile.name, fileType: editLessonFile.type, fileSize: editLessonFile.size })
      : editLessonContent || "";
    const { error } = await supabase.from("lessons").update({ title: editLessonTitle, content: contentValue }).eq("id", editingLessonId);
    if (error) return toast.error(error.message);
    toast.success("Урок обновлён");
    setOpenEditLesson(false);
    setEditingLessonId(null);
    qc.invalidateQueries({ queryKey: ["course-data", courseId] });
  };

  const deleteLesson = async (id: string) => {
    if (!confirm("Удалить урок?")) return;
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Урок удалён");
    qc.invalidateQueries({ queryKey: ["course-data", courseId] });
  };

  const openEditTestDialog = (t: any) => {
    setEditingTestId(t.id);
    setEditTestTitle(t.title ?? "");
    setEditTestDesc(t.description ?? "");
    setTestQuestions([]);
    setOpenEditTest(true);
    void (async () => {
      const { data, error } = await supabase.from("questions").select("*").eq("test_id", t.id).order("id");
      if (error) return toast.error(error.message);
      setTestQuestions((data ?? []).map((q: any) => ({ ...q, options: q.options ?? [""], correct_index: q.correct_index ?? 0 })));
    })();
  };

  const updateQuestionText = (questionIndex: number, text: string) => {
    setTestQuestions((prev) => prev.map((question, index) => index === questionIndex ? { ...question, text } : question));
  };

  const updateQuestionOption = (questionIndex: number, optionIndex: number, value: string) => {
    setTestQuestions((prev) => prev.map((question, index) => index === questionIndex ? {
      ...question,
      options: (question.options ?? [""]).map((option: string, optIndex: number) => optIndex === optionIndex ? value : option),
    } : question));
  };

  const addQuestionOption = (questionIndex: number) => {
    setTestQuestions((prev) => prev.map((question, index) => index === questionIndex ? {
      ...question,
      options: [...(question.options ?? [""]), ""],
    } : question));
  };

  const removeQuestionOption = (questionIndex: number) => {
    setTestQuestions((prev) => prev.map((question, index) => index === questionIndex ? {
      ...question,
      options: (question.options ?? [""]).length <= 1 ? (question.options ?? [""]) : (question.options ?? [""]).slice(0, -1),
    } : question));
  };

  const setQuestionCorrectIndex = (questionIndex: number, optionIndex: number) => {
    setTestQuestions((prev) => prev.map((question, index) => index === questionIndex ? { ...question, correct_index: optionIndex } : question));
  };

  const addQuestion = () => {
    setTestQuestions((prev) => [...prev, { id: null, text: "", options: [""], correct_index: 0 }]);
  };

  const removeQuestion = (questionIndex: number) => {
    setTestQuestions((prev) => {
      const question = prev[questionIndex];
      if (!question?.id) return prev.filter((_, index) => index !== questionIndex);
      return prev.map((item, index) => index === questionIndex ? { ...item, _deleted: true } : item);
    });
  };

  const openViewLessonDialog = (lesson: any) => {
    setViewLessonTitle(lesson.title ?? "");
    setViewLessonText(null);
    setViewLessonFileName(null);
    setViewLessonFileType(null);
    setViewLessonDataUrl(null);
    try {
      const content = lesson.content;
      if (!content) {
        setViewLessonText("");
      } else {
        // try parse JSON (file metadata with dataUrl)
        let parsed: any = null;
        try { parsed = JSON.parse(content); } catch (e) { parsed = null; }
        if (parsed && parsed.dataUrl) {
          setViewLessonFileName(parsed.fileName ?? null);
          setViewLessonFileType(parsed.fileType ?? null);
          setViewLessonDataUrl(parsed.dataUrl ?? null);
        } else {
          setViewLessonText(String(content));
        }
      }
    } catch (e) {
      setViewLessonText("Ошибка при загрузке содержимого");
    }
    setOpenViewLesson(true);
  };

  const saveEditTest = async () => {
    if (!editingTestId || !editTestTitle) return;

    const { error: testError } = await supabase.from("tests").update({ title: editTestTitle, description: editTestDesc || null }).eq("id", editingTestId);
    if (testError) return toast.error(testError.message);

    const toInsert = testQuestions.filter((question) => !question.id && !question._deleted).map((question) => ({
      test_id: editingTestId,
      text: question.text || "",
      options: question.options ?? [""],
      correct_index: question.correct_index ?? 0,
    }));

    const toUpdate = testQuestions.filter((question) => question.id && !question._deleted);
    const toDeleteIds = testQuestions.filter((question) => question.id && question._deleted).map((question) => question.id);

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from("questions").insert(toInsert);
      if (insertError) return toast.error(insertError.message);
    }

    for (const question of toUpdate) {
      const { error: updateError } = await supabase.from("questions").update({
        text: question.text || "",
        options: question.options ?? [""],
        correct_index: question.correct_index ?? 0,
      }).eq("id", question.id);
      if (updateError) return toast.error(updateError.message);
    }

    if (toDeleteIds.length > 0) {
      const { error: deleteError } = await supabase.from("questions").delete().in("id", toDeleteIds);
      if (deleteError) return toast.error(deleteError.message);
    }

    toast.success("Тест и вопросы обновлены");
    setOpenEditTest(false);
    setEditingTestId(null);
    setEditTestTitle("");
    setEditTestDesc("");
    setTestQuestions([]);
    qc.invalidateQueries({ queryKey: ["course-data", courseId] });
  };

  const deleteTest = async (id: string) => {
    if (!confirm("Удалить тест?")) return;
    const { error } = await supabase.from("tests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Тест удалён");
    qc.invalidateQueries({ queryKey: ["course-data", courseId] });
  };

  const resendTeacherApplication = async () => {
    if (!user || !reuploadFile) {
      toast.error("Пожалуйста, выберите новый диплом");
      return;
    }

    try {
      setReuploadLoading(true);
      validateTeacherDiplomaFile(reuploadFile);
      const formData = new FormData();
      formData.append("full_name", user.user_metadata?.full_name ?? user.email ?? "");
      formData.append("email", user.email ?? "");
      formData.append("diploma", reuploadFile);
      formData.append("previous_diploma_url", teacherApplication?.diploma_url ?? "");
      await submitTeacherApplication({ data: formData });

      toast.success("Заявка отправлена повторно");
      setReuploadOpen(false);
      setReuploadFile(null);
      qc.invalidateQueries({ queryKey: ["teacher-application", user.id] });
    } catch (error) {
      console.error("resendTeacherApplication error:", error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
            ? String((error as { message: unknown }).message)
            : "Не удалось отправить заявку повторно";
      toast.error(message);
    } finally {
      setReuploadLoading(false);
    }
  };

  const submitNewTeacherApplication = async () => {
    if (!user || !newApplicationFile) {
      toast.error("Пожалуйста, выберите диплом");
      return;
    }

    try {
      setNewApplicationLoading(true);
      validateTeacherDiplomaFile(newApplicationFile);
      const formData = new FormData();
      formData.append("full_name", user.user_metadata?.full_name ?? user.email ?? "");
      formData.append("email", user.email ?? "");
      formData.append("diploma", newApplicationFile);
      await submitTeacherApplication({ data: formData });
      toast.success("Ваша заявка отправлена администратору.");
      setNewApplicationFile(null);
      qc.invalidateQueries({ queryKey: ["teacher-application", user.id] });
    } catch (error) {
      console.error("submitNewTeacherApplication error:", error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
            ? String((error as { message: unknown }).message)
            : "Не удалось отправить заявку";
      toast.error(message);
    } finally {
      setNewApplicationLoading(false);
    }
  };

  const createTest = async () => {
    if (!courseId || !testTitle || !questionText || options.length === 0) {
      return toast.error("Укажите название теста, вопрос и хотя бы один ответ.");
    }
    if (options.some((option) => !option.trim())) {
      return toast.error("Все варианты ответов должны быть заполнены.");
    }

    const { data: testData, error: testError } = await supabase
      .from("tests")
      .insert({ course_id: courseId, title: testTitle, description: testDesc || null })
      .select("id")
      .single();

    if (testError || !testData?.id) {
      return toast.error(testError?.message || "Ошибка создания теста");
    }

    const { error: questionError } = await supabase.from("questions").insert({
      test_id: testData.id,
      text: questionText,
      options,
      correct_index: correctIndex,
    });

    if (questionError) return toast.error(questionError.message);

    toast.success("Тест и вопрос добавлены");
    setOpenTest(false);
    setTestTitle("");
    setTestDesc("");
    setQuestionText("");
    setOptions([""]);
    setCorrectIndex(0);
    qc.invalidateQueries({ queryKey: ["course-data", courseId] });
  };

  const isTeacherApplicationReady = !authLoading && !teacherApplicationLoading;
  const hasPendingTeacherApplication = Boolean(user && (teacherApplication?.status === "pending" || teacherApplication?.status === "rejected"));
  const isApprovedTeacher = teacherApplication?.status === "approved";

  if (!roles.includes("admin") && isTeacherApplicationReady && !teacherApplication) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-lg font-medium text-foreground">У вас еще нет заявки преподавателя</div>
              <div>Загрузите диплом, чтобы отправить заявку на проверку администратору.</div>
            </div>
            <div className="mx-auto max-w-md space-y-3 text-left">
              <div className="space-y-2">
                <Label htmlFor="new-teacher-diploma">Диплом (PDF, JPG, JPEG, PNG, до 10 МБ)</Label>
                <Input
                  id="new-teacher-diploma"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) => setNewApplicationFile(event.target.files?.[0] ?? null)}
                />
                {newApplicationFile && (
                  <p className="text-xs text-muted-foreground">Выбран: {newApplicationFile.name}</p>
                )}
              </div>
              <Button className="w-full" onClick={submitNewTeacherApplication} disabled={newApplicationLoading}>
                Отправить заявку
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isTeacherApplicationReady) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <div>Загружаем данные преподавателя...</div>
        </CardContent>
      </Card>
    );
  }

  if (!roles.includes("admin") && !isApprovedTeacher && !hasPendingTeacherApplication) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <div className="space-y-4">
          <div>У вас еще нет активной заявки преподавателя. Выберите диплом и отправьте заявку на проверку.</div>
          <div className="mx-auto max-w-md space-y-3 text-left">
            <div className="space-y-2">
              <Label htmlFor="new-teacher-diploma">Диплом (PDF, JPG, JPEG, PNG, до 10 МБ)</Label>
              <Input
                id="new-teacher-diploma"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(event) => setNewApplicationFile(event.target.files?.[0] ?? null)}
              />
              {newApplicationFile && (
                <p className="text-xs text-muted-foreground">Выбран: {newApplicationFile.name}</p>
              )}
            </div>
            <Button className="w-full" onClick={submitNewTeacherApplication} disabled={newApplicationLoading}>
              Отправить заявку
            </Button>
          </div>
        </div>
      </CardContent></Card>
    );
  }

  if (!roles.includes("admin") && !isApprovedTeacher) {
    const status = teacherApplication?.status;
    const rejectionReason = teacherApplication?.rejection_reason;

    return (
      <Card><CardContent className="py-12 text-center">
        <div className="space-y-4">
          {status === "pending" && (
            <>
              <div className="text-2xl">🟡</div>
              <h2 className="text-xl font-semibold">Ожидает проверки</h2>
              <p className="text-muted-foreground">Ваш аккаунт преподавателя ожидает проверки администратором.</p>
            </>
          )}
          {status === "rejected" && (
            <>
              <div className="text-2xl">🔴</div>
              <h2 className="text-xl font-semibold">Отклонен</h2>
              <p className="text-muted-foreground">Причина: {rejectionReason || "Не указана"}</p>
              <Button onClick={() => setReuploadOpen(true)}>Отправить повторно</Button>
            </>
          )}
        </div>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Кабинет преподавателя</h1>
          <p className="text-muted-foreground">Создавайте и управляйте своими курсами.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Новый курс</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Новый курс</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Название</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="space-y-2"><Label>Описание</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
              <div className="space-y-2"><Label>Предмет</Label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>
                    {(subjects ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={createCourse}>Создать</Button></DialogFooter>
          </DialogContent>
        </Dialog>
                <Dialog open={openEditLesson} onOpenChange={setOpenEditLesson}>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Редактировать урок</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2"><Label>Название</Label><Input value={editLessonTitle} onChange={(e) => setEditLessonTitle(e.target.value)} /></div>
                      <div className="space-y-2">
                        <Label>Загрузить файл</Label>
                        <Input type="file" onChange={(e) => setEditLessonFile(e.target.files?.[0] ?? null)} />
                        {editLessonFile && <div className="text-sm text-muted-foreground">Выбран файл: {editLessonFile.name}</div>}
                      </div>
                      <div className="space-y-2"><Label>Или текст урока</Label><Textarea value={editLessonContent} onChange={(e) => setEditLessonContent(e.target.value)} rows={6} /></div>
                    </div>
                    <DialogFooter><Button onClick={saveEditLesson}>Сохранить</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog open={openViewLesson} onOpenChange={setOpenViewLesson}>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{viewLessonTitle}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      {viewLessonDataUrl ? (
                        <div>
                          {viewLessonFileType?.startsWith("image/") ? (
                            // eslint-disable-next-line jsx-a11y/img-redundant-alt
                            <img src={viewLessonDataUrl} alt={viewLessonFileName ?? "lesson image"} className="max-w-full rounded" />
                          ) : viewLessonFileType === "application/pdf" ? (
                            <iframe src={viewLessonDataUrl} className="w-full h-96" title={viewLessonFileName ?? "pdf"} />
                          ) : (
                            <div>
                              <a href={viewLessonDataUrl} download={viewLessonFileName ?? "file"} className="text-primary underline">Скачать файл</a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <pre className="whitespace-pre-wrap text-sm">{viewLessonText}</pre>
                        </div>
                      )}
                    </div>
                    <DialogFooter><Button onClick={() => setOpenViewLesson(false)}>Закрыть</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog open={openEditTest} onOpenChange={setOpenEditTest}>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader><DialogTitle>Редактировать тест</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2"><Label>Название</Label><Input value={editTestTitle} onChange={(e) => setEditTestTitle(e.target.value)} /></div>
                      <div className="space-y-2"><Label>Описание</Label><Textarea value={editTestDesc} onChange={(e) => setEditTestDesc(e.target.value)} rows={4} /></div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <Label>Вопросы</Label>
                          <Button size="sm" variant="outline" onClick={addQuestion}>Добавить вопрос</Button>
                        </div>
                        {testQuestions.filter((question) => !question._deleted).map((question, questionIndex) => (
                          <div key={question.id ?? `new-${questionIndex}`} className="rounded-lg border border-border p-3 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium">Вопрос {questionIndex + 1}</div>
                              <Button size="sm" variant="ghost" onClick={() => removeQuestion(questionIndex)}>Удалить</Button>
                            </div>
                            <Input
                              value={question.text ?? ""}
                              placeholder="Текст вопроса"
                              onChange={(e) => updateQuestionText(questionIndex, e.target.value)}
                            />
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <Label>Варианты ответов</Label>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => addQuestionOption(questionIndex)} disabled={(question.options ?? []).length >= 44}>+</Button>
                                  <Button size="sm" variant="outline" onClick={() => removeQuestionOption(questionIndex)} disabled={(question.options ?? []).length <= 1}>-</Button>
                                </div>
                              </div>
                              {(question.options ?? []).map((option: string, optionIndex: number) => (
                                <div key={`${questionIndex}-${optionIndex}`} className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`correct-${questionIndex}`}
                                    checked={(question.correct_index ?? 0) === optionIndex}
                                    onChange={() => setQuestionCorrectIndex(questionIndex, optionIndex)}
                                    className="h-4 w-4"
                                  />
                                  <Input
                                    value={option ?? ""}
                                    placeholder={`Вариант ${optionIndex + 1}`}
                                    onChange={(e) => updateQuestionOption(questionIndex, optionIndex, e.target.value)}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <DialogFooter><Button onClick={saveEditTest}>Сохранить</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
        <Dialog open={openEdit} onOpenChange={setOpenEdit}>
          <DialogContent>
            <DialogHeader><DialogTitle>Редактировать курс</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Название</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></div>
              <div className="space-y-2"><Label>Описание</Label><Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={4} /></div>
              <div className="space-y-2"><Label>Предмет</Label>
                <Select value={editSubjectId} onValueChange={setEditSubjectId}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>
                    {(subjects ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2"><Label>Опубликован</Label><Switch checked={editPublished} onCheckedChange={(v) => setEditPublished(Boolean(v))} /></div>
            </div>
            <DialogFooter>
              <Button onClick={saveEditCourse}>Сохранить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Мои курсы</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(courses ?? []).length === 0 && <p className="text-sm text-muted-foreground">Курсов пока нет.</p>}
          {(courses ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <div className="font-medium">{c.title}</div>
                <div className="text-xs text-muted-foreground">{(c.subjects as { name?: string } | null)?.name}</div>
              </div>
              <div className="flex gap-2">
                <Link to="/teacher" search={{ courseId: c.id } as never}>
                  <Button variant="outline" size="sm">Открыть</Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => openEditCourse(c)}>Изменить</Button>
                <Button variant="ghost" size="sm" onClick={async () => {
                  if (!confirm("Удалить курс?")) return;
                  await supabase.from("courses").delete().eq("id", c.id);
                  qc.invalidateQueries({ queryKey: ["my-courses", user?.id] });
                }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {courseId && (
        <Card>
          <CardHeader><CardTitle>Редактирование курса</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {courseData?.course ? (
              <>
                <div className="space-y-2">
                  <div className="font-semibold">{courseData.course.title}</div>
                  <div className="text-xs text-muted-foreground">{(courseData.course.subjects as { name?: string } | null)?.name ?? "Без предмета"}</div>
                  <div className="text-sm text-muted-foreground">Уроков: {courseData.lessons.length}, тестов: {courseData.tests.length}</div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Dialog open={openLesson} onOpenChange={setOpenLesson}>
                    <DialogTrigger asChild>
                      <Button className="w-full">Добавить урок</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Новый урок</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2"><Label>Название</Label><Input value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} /></div>
                        <div className="space-y-2">
                          <Label>Загрузить файл</Label>
                          <Input
                            type="file"
                            onChange={(e) => setLessonFile(e.target.files?.[0] ?? null)}
                          />
                          {lessonFile && <div className="text-sm text-muted-foreground">Выбран файл: {lessonFile.name}</div>}
                        </div>
                        <div className="space-y-2">
                          <Label>Или текст урока</Label>
                          <Textarea value={lessonContent} onChange={(e) => setLessonContent(e.target.value)} rows={6} />
                        </div>
                      </div>
                      <DialogFooter><Button onClick={createLesson}>Сохранить</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={openTest} onOpenChange={setOpenTest}>
                    <DialogTrigger asChild>
                      <Button className="w-full">Добавить тест</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Новый тест</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2"><Label>Название</Label><Input value={testTitle} onChange={(e) => setTestTitle(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Описание</Label><Textarea value={testDesc} onChange={(e) => setTestDesc(e.target.value)} rows={4} /></div>
                        <div className="space-y-2"><Label>Вопрос</Label><Input value={questionText} onChange={(e) => setQuestionText(e.target.value)} /></div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label>Варианты ответов</Label>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => setOptions((prev) => prev.length < 44 ? [...prev, ""] : prev)} disabled={options.length >= 44}>
                                +
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setOptions((prev) => {
                                if (prev.length <= 1) return prev;
                                const next = prev.slice(0, -1);
                                if (correctIndex >= next.length) {
                                  setCorrectIndex(next.length - 1);
                                }
                                return next;
                              })} disabled={options.length <= 1}>
                                -
                              </Button>
                            </div>
                          </div>
                          {options.map((option, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="correctOption"
                                checked={correctIndex === index}
                                onChange={() => setCorrectIndex(index)}
                                className="h-4 w-4"
                              />
                              <Input
                                value={option}
                                placeholder={`Вариант ${index + 1}`}
                                onChange={(e) => setOptions((prev) => prev.map((opt, idx) => idx === index ? e.target.value : opt))}
                              />
                            </div>
                          ))}
                          <div className="text-xs text-muted-foreground">
                            Укажите правильный вариант, выбрав кружок.
                          </div>
                        </div>
                      </div>
                      <DialogFooter><Button onClick={createTest}>Сохранить</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Card className="border border-border p-4">
                    <div className="font-medium">Уроки</div>
                    <div className="space-y-2 mt-3">
                      {courseData.lessons.length === 0 && <div className="text-sm text-muted-foreground">Пока нет уроков</div>}
                      {courseData.lessons.map((l: any, i: number) => (
                        <div key={l.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-6 text-sm font-semibold">{i + 1}</div>
                            <div className="font-medium">{l.title}</div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openViewLessonDialog(l)}>Открыть</Button>
                            <Button size="sm" variant="ghost" onClick={() => openEditLessonDialog(l)}>Изменить</Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteLesson(l.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card className="border border-border p-4">
                    <div className="font-medium">Тесты</div>
                    <div className="space-y-2 mt-3">
                      {courseData.tests.length === 0 && <div className="text-sm text-muted-foreground">Пока нет тестов</div>}
                      {courseData.tests.map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                          <div className="font-medium">{t.title}</div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openEditTestDialog(t)}>Изменить</Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteTest(t.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Загружается выбранный курс...</div>
            )}
          </CardContent>
        </Card>
      )}
      {!courseId && (
        <Card>
          <CardHeader><CardTitle>Подсказка</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Для добавления уроков и тестов к курсу откройте его из списка выше.
          </CardContent>
        </Card>
      )}
      <Dialog open={reuploadOpen} onOpenChange={setReuploadOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Отправить заявку повторно</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reupload-diploma">Новый диплом (PDF, JPG, JPEG, PNG, до 10 МБ)</Label>
              <Input
                id="reupload-diploma"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(event) => setReuploadFile(event.target.files?.[0] ?? null)}
              />
              {reuploadFile && <p className="text-xs text-muted-foreground">Выбран: {reuploadFile.name}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReuploadOpen(false)}>Отмена</Button>
            <Button onClick={resendTeacherApplication} disabled={reuploadLoading}>Отправить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
