import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  sanitizeTeacherDiplomaFileName,
  TEACHER_DOCUMENTS_BUCKET,
  validateTeacherDiplomaFile,
} from "@/lib/teacher-applications.shared";

export type TeacherApplicationRow = {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  diploma_url: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export const submitTeacherApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: FormData) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const fullName = String(data.get("full_name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const diplomaValue = data.get("diploma");
    const previousDiplomaUrl = String(data.get("previous_diploma_url") ?? "").trim();

    // In some server runtimes (Node.js/Nitro) FormData file entries arrive as
    // Blob instead of File. Both have .type and .size; File additionally has
    // .name. We accept either so the upload does not fail unnecessarily.
    if (!(diplomaValue instanceof File) && !(diplomaValue instanceof Blob)) {
      throw new Error("Пожалуйста, загрузите диплом для регистрации преподавателем");
    }

    validateTeacherDiplomaFile(diplomaValue as File);

    const now = new Date().toISOString();
    const originalName = (diplomaValue as File).name ?? "diploma";
    const safeName = sanitizeTeacherDiplomaFileName(originalName);
    const filePath = `${userId}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage.from(TEACHER_DOCUMENTS_BUCKET).upload(filePath, diplomaValue, {
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadError) {
      const message = uploadError.message.toLowerCase();
      if (
        message.includes("bucket not found") ||
        message.includes("the resource was not found") ||
        message.includes("not found") && message.includes("bucket")
      ) {
        throw new Error(
          "В Supabase Storage не найден bucket teacher-documents. Создайте bucket и примените миграцию 20260630120000_teacher_applications.sql.",
        );
      }

      throw new Error(`Ошибка загрузки диплома: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from(TEACHER_DOCUMENTS_BUCKET).getPublicUrl(filePath);

    const { data: existingProfile, error: profileSelectError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (profileSelectError) throw profileSelectError;

    if (existingProfile) {
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName || null,
          updated_at: now,
        })
        .eq("id", userId);

      if (profileUpdateError) throw profileUpdateError;
    } else {
      const { error: profileInsertError } = await supabase.from("profiles").insert({
        id: userId,
        full_name: fullName || null,
        created_at: now,
        updated_at: now,
      });

      if (profileInsertError) throw profileInsertError;
    }

    const { data: existingApplication, error: applicationSelectError } = await supabase
      .from("teacher_applications")
      .select("id, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (applicationSelectError) throw applicationSelectError;

    if (existingApplication) {
      const { error: applicationUpdateError } = await supabase
        .from("teacher_applications")
        .update({
          email: email || null,
          full_name: fullName || null,
          diploma_url: publicUrlData.publicUrl,
          status: "pending",
          rejection_reason: null,
          reviewed_at: null,
          reviewed_by: null,
        })
        .eq("id", existingApplication.id);

      if (applicationUpdateError) throw applicationUpdateError;
    } else {
      const { error: applicationInsertError } = await supabase.from("teacher_applications").insert({
        user_id: userId,
        email: email || null,
        full_name: fullName || null,
        diploma_url: publicUrlData.publicUrl,
        status: "pending",
        rejection_reason: null,
        reviewed_at: null,
        reviewed_by: null,
        created_at: now,
      });

      if (applicationInsertError) throw applicationInsertError;
    }

    if (previousDiplomaUrl) {
      const marker = `/storage/v1/object/public/${TEACHER_DOCUMENTS_BUCKET}/`;
      const previousPath = previousDiplomaUrl.includes(marker)
        ? decodeURIComponent(previousDiplomaUrl.split(marker)[1] ?? "")
        : "";

      if (previousPath) {
        const { error: removeError } = await supabase.storage.from(TEACHER_DOCUMENTS_BUCKET).remove([previousPath]);
        if (removeError) {
          console.warn("Failed to remove previous teacher diploma", removeError.message);
        }
      }
    }

    return { diplomaUrl: publicUrlData.publicUrl };
  });
