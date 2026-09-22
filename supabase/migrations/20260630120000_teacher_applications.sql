-- Teacher applications storage and RLS

create table if not exists public.teacher_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  full_name text,
  diploma_url text,
  status text not null default 'pending',
  rejection_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

create unique index if not exists teacher_applications_user_id_key
  on public.teacher_applications (user_id);

alter table public.teacher_applications
  alter column status set default 'pending',
  alter column created_at set default now();

alter table public.teacher_applications
  add column if not exists email text;

alter table public.teacher_applications
  add column if not exists full_name text;

update public.teacher_applications ta
set email = u.email
from auth.users u
where u.id = ta.user_id and ta.email is null;

update public.teacher_applications ta
set full_name = p.full_name
from public.profiles p
where p.id = ta.user_id and ta.full_name is null;

do $$
begin
  insert into storage.buckets (id, name, public)
  values ('teacher-documents', 'teacher-documents', true)
  on conflict (id) do nothing;
end $$;

alter table public.teacher_applications enable row level security;

drop policy if exists "Teacher applications admins read all" on public.teacher_applications;
create policy "Teacher applications admins read all"
on public.teacher_applications
for select
using (private.has_role(auth.uid(), 'admin'));

drop policy if exists "Teacher applications owners read own" on public.teacher_applications;
create policy "Teacher applications owners read own"
on public.teacher_applications
for select
using (auth.uid() = user_id);

drop policy if exists "Teacher applications owners insert own" on public.teacher_applications;
create policy "Teacher applications owners insert own"
on public.teacher_applications
for insert
with check (auth.uid() = user_id);

drop policy if exists "Teacher applications owners update pending or rejected" on public.teacher_applications;
create policy "Teacher applications owners update pending or rejected"
on public.teacher_applications
for update
using (auth.uid() = user_id and status in ('pending', 'rejected'))
with check (auth.uid() = user_id and status in ('pending', 'rejected'));

drop policy if exists "Teacher applications admins update all" on public.teacher_applications;
create policy "Teacher applications admins update all"
on public.teacher_applications
for update
using (private.has_role(auth.uid(), 'admin'))
with check (private.has_role(auth.uid(), 'admin'));

drop policy if exists "Teacher diploma uploads own files" on storage.objects;
create policy "Teacher diploma uploads own files"
on storage.objects
for insert
with check (
  bucket_id = 'teacher-documents'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "Teacher diploma deletes own files" on storage.objects;
create policy "Teacher diploma deletes own files"
on storage.objects
for delete
using (
  bucket_id = 'teacher-documents'
  and auth.uid()::text = split_part(name, '/', 1)
);
