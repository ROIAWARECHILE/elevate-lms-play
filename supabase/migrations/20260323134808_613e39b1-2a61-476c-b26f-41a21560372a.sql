
-- Fix: Replace overly permissive companies insert policy
DROP POLICY "Admins can insert companies" ON public.companies;

-- Allow authenticated users to create a company only if they don't have one yet
CREATE POLICY "Users without company can create one" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_company_id(auth.uid()) IS NULL);
