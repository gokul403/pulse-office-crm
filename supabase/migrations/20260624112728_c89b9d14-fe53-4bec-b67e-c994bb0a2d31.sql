
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost');
CREATE TYPE public.customer_status AS ENUM ('active', 'inactive', 'prospect');
CREATE TYPE public.interaction_type AS ENUM ('call', 'email', 'meeting', 'note');

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, email text, phone text, company text, source text,
  status public.lead_status NOT NULL DEFAULT 'new',
  notes text,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_select" ON public.leads FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR assigned_to = auth.uid());
CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR assigned_to = auth.uid());
CREATE POLICY "leads_delete" ON public.leads FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, email text, phone text, company text, address text,
  status public.customer_status NOT NULL DEFAULT 'active',
  notes text,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR assigned_to = auth.uid());
CREATE POLICY "customers_insert" ON public.customers FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR assigned_to = auth.uid());
CREATE POLICY "customers_delete" ON public.customers FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customer_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  type public.interaction_type NOT NULL DEFAULT 'note',
  summary text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_interactions TO authenticated;
GRANT ALL ON public.customer_interactions TO service_role;
ALTER TABLE public.customer_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interactions_select" ON public.customer_interactions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR c.assigned_to = auth.uid())));
CREATE POLICY "interactions_insert" ON public.customer_interactions FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR c.assigned_to = auth.uid())));
CREATE POLICY "interactions_delete" ON public.customer_interactions FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  source text NOT NULL, category text, description text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  received_on date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income TO authenticated;
GRANT ALL ON public.income TO service_role;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
CREATE POLICY "income_select" ON public.income FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "income_insert" ON public.income FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "income_update" ON public.income FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "income_delete" ON public.income FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_income_updated_at BEFORE UPDATE ON public.income FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  category text NOT NULL, vendor text, description text,
  spent_on date NOT NULL DEFAULT CURRENT_DATE,
  paid_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_select" ON public.expenses FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "expenses_update" ON public.expenses FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "expenses_delete" ON public.expenses FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed demo data
DO $$
DECLARE _admin uuid; _mgr uuid; _emp1 uuid; _cust1 uuid; _cust2 uuid;
BEGIN
  SELECT id INTO _admin FROM public.profiles WHERE email='admin@demo.com';
  SELECT id INTO _mgr   FROM public.profiles WHERE email='manager@demo.com';
  SELECT id INTO _emp1  FROM public.profiles WHERE email='employee1@demo.com';

  INSERT INTO public.leads (name,email,phone,company,source,status,notes,assigned_to,created_by) VALUES
  ('Acme Corp','hello@acme.io','+1 555 0100','Acme Corp','Website','new','Wants pricing for 50 seats',_emp1,_mgr),
  ('Globex LLC','sales@globex.io','+1 555 0111','Globex','Referral','contacted','Follow up next week',_emp1,_mgr),
  ('Initech','tps@initech.com','+1 555 0122','Initech','Cold call','qualified','Demo scheduled',_mgr,_mgr),
  ('Umbrella Co','ops@umbrella.io','+1 555 0133','Umbrella','LinkedIn','proposal','Sent proposal v2',_mgr,_admin);

  INSERT INTO public.customers (name,email,phone,company,address,status,assigned_to,created_by) VALUES
  ('Stark Industries','tony@stark.io','+1 555 0200','Stark Industries','Malibu, CA','active',_mgr,_admin),
  ('Wayne Enterprises','bruce@wayne.io','+1 555 0201','Wayne Enterprises','Gotham','active',_emp1,_admin);

  SELECT id INTO _cust1 FROM public.customers WHERE name='Stark Industries';
  SELECT id INTO _cust2 FROM public.customers WHERE name='Wayne Enterprises';

  INSERT INTO public.customer_interactions (customer_id,type,summary,created_by) VALUES
  (_cust1,'call','Quarterly check-in call. All good.',_mgr),
  (_cust1,'email','Sent updated SLA document.',_emp1),
  (_cust2,'meeting','On-site review meeting.',_mgr);

  INSERT INTO public.income (amount,source,category,description,customer_id,received_on,created_by) VALUES
  (12500.00,'Stark Industries','Services','Q1 retainer',_cust1,CURRENT_DATE-20,_admin),
  ( 4800.00,'Wayne Enterprises','License','Annual license renewal',_cust2,CURRENT_DATE-10,_admin),
  ( 2200.00,'Stark Industries','Consulting','Strategy workshop',_cust1,CURRENT_DATE-3, _mgr);

  INSERT INTO public.expenses (amount,category,vendor,description,spent_on,paid_by,created_by) VALUES
  (1200.00,'Software','Atlassian','Jira annual',CURRENT_DATE-25,_admin,_admin),
  ( 340.00,'Office','Staples','Office supplies',CURRENT_DATE-15,_mgr,_mgr),
  (2500.00,'Marketing','Meta Ads','Q1 campaign',CURRENT_DATE-8,_mgr,_admin),
  ( 680.00,'Travel','Delta','Client visit flights',CURRENT_DATE-2,_mgr,_admin);
END $$;
