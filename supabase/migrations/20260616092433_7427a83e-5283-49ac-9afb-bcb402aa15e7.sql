
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

REVOKE EXECUTE ON FUNCTION private.has_role(UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(UUID, public.app_role) TO authenticated, anon, service_role;

-- Recreate policies that referenced public.has_role
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL
USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Teachers and admins manage subjects" ON public.subjects;
CREATE POLICY "Teachers and admins manage subjects" ON public.subjects FOR ALL
USING (private.has_role(auth.uid(), 'teacher') OR private.has_role(auth.uid(), 'admin'))
WITH CHECK (private.has_role(auth.uid(), 'teacher') OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Courses readable by all when published" ON public.courses;
CREATE POLICY "Courses readable by all when published" ON public.courses FOR SELECT
USING (is_published = true OR teacher_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Teachers manage own courses" ON public.courses;
CREATE POLICY "Teachers manage own courses" ON public.courses FOR ALL
USING (teacher_id = auth.uid() OR private.has_role(auth.uid(), 'admin'))
WITH CHECK (teacher_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Teachers manage lessons of own courses" ON public.lessons;
CREATE POLICY "Teachers manage lessons of own courses" ON public.lessons FOR ALL
USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND (c.teacher_id = auth.uid() OR private.has_role(auth.uid(), 'admin'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND (c.teacher_id = auth.uid() OR private.has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "Teachers manage tests of own courses" ON public.tests;
CREATE POLICY "Teachers manage tests of own courses" ON public.tests FOR ALL
USING (course_id IS NULL AND private.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND (c.teacher_id = auth.uid() OR private.has_role(auth.uid(), 'admin'))))
WITH CHECK (course_id IS NULL AND private.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND (c.teacher_id = auth.uid() OR private.has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "Teachers manage questions" ON public.questions;
CREATE POLICY "Teachers manage questions" ON public.questions FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.tests t LEFT JOIN public.courses c ON c.id = t.course_id
  WHERE t.id = test_id AND (c.teacher_id = auth.uid() OR private.has_role(auth.uid(), 'admin'))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.tests t LEFT JOIN public.courses c ON c.id = t.course_id
  WHERE t.id = test_id AND (c.teacher_id = auth.uid() OR private.has_role(auth.uid(), 'admin'))
));

DROP FUNCTION IF EXISTS public.has_role(UUID, public.app_role);
