-- Drop the FK constraint on reviewed_by so admins can approve/reject
-- applications without triggering a FK violation. The column stores the
-- admin's user ID as metadata only; a strict reference is not needed and
-- can break when the admin account is not found in the referenced table.
alter table public.teacher_applications
  drop constraint if exists teacher_applications_reviewed_by_fkey;
