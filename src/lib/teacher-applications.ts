import { supabase } from "@/integrations/supabase/client";
import { sanitizeTeacherDiplomaFileName, TEACHER_DIPLOMA_ALLOWED_TYPES, TEACHER_DIPLOMA_MAX_SIZE_BYTES, TEACHER_DOCUMENTS_BUCKET, validateTeacherDiplomaFile } from "@/lib/teacher-applications.shared";

export async function ensureTeacherDocumentsBucket() {
  // The bucket is created via SQL migration. Keep this as a no-op guard so
  // callers can keep the same flow without trying to create buckets client-side.
  return;
}

export async function uploadTeacherDiploma(userId: string, file: File) {
  await ensureTeacherDocumentsBucket();

  const safeName = sanitizeTeacherDiplomaFileName(file.name);
  const filePath = `${userId}/${Date.now()}_${safeName}`;

  const { error } = await supabase.storage.from(TEACHER_DOCUMENTS_BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(TEACHER_DOCUMENTS_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export function getTeacherDiplomaStoragePath(diplomaUrl: string) {
  try {
    const url = new URL(diplomaUrl);
    const marker = `/storage/v1/object/public/${TEACHER_DOCUMENTS_BUCKET}/`;
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

export async function removeTeacherDiplomaByUrl(diplomaUrl: string) {
  const storagePath = getTeacherDiplomaStoragePath(diplomaUrl);
  if (!storagePath) return;

  const { error } = await supabase.storage.from(TEACHER_DOCUMENTS_BUCKET).remove([storagePath]);
  if (error) {
    throw new Error(error.message);
  }
}
