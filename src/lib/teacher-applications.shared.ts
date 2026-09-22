export const TEACHER_DIPLOMA_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"] as const;
export const TEACHER_DIPLOMA_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const TEACHER_DOCUMENTS_BUCKET = "teacher-documents";

export function validateTeacherDiplomaFile(file: File) {
  if (!TEACHER_DIPLOMA_ALLOWED_TYPES.includes(file.type as (typeof TEACHER_DIPLOMA_ALLOWED_TYPES)[number])) {
    throw new Error("Диплом должен быть в формате PDF, JPG, JPEG или PNG");
  }

  if (file.size > TEACHER_DIPLOMA_MAX_SIZE_BYTES) {
    throw new Error("Размер файла не должен превышать 10 МБ");
  }
}

export function sanitizeTeacherDiplomaFileName(fileName: string) {
  return fileName.replace(/[\\/]+/g, "_").replace(/\s+/g, "_");
}

