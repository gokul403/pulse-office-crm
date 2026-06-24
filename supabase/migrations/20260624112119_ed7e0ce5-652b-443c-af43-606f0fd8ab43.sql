
-- Seed demo users with hardcoded credentials. Idempotent.
DO $$
DECLARE
  _users TEXT[][] := ARRAY[
    ['admin@demo.com',    'Admin1234!',    'Admin User'],
    ['manager@demo.com',  'Manager1234!',  'Manager User'],
    ['employee1@demo.com','Employee1234!', 'Employee One'],
    ['employee2@demo.com','Employee1234!', 'Employee Two'],
    ['employee3@demo.com','Employee1234!', 'Employee Three']
  ];
  _row TEXT[];
  _uid uuid;
  _email TEXT;
  _password TEXT;
  _full_name TEXT;
  _role public.app_role;
BEGIN
  FOREACH _row SLICE 1 IN ARRAY _users LOOP
    _email := _row[1];
    _password := _row[2];
    _full_name := _row[3];

    SELECT id INTO _uid FROM auth.users WHERE email = _email;

    IF _uid IS NULL THEN
      _uid := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change,
        email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', _uid, 'authenticated', 'authenticated',
        _email, crypt(_password, gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', _full_name),
        now(), now(), '', '', '', ''
      );

      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), _uid, jsonb_build_object('sub', _uid::text, 'email', _email), 'email', _uid::text, now(), now(), now());
    END IF;

    -- Ensure profile
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (_uid, _email, _full_name)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name;

    -- Determine role
    IF _email = 'admin@demo.com' THEN _role := 'admin';
    ELSIF _email = 'manager@demo.com' THEN _role := 'manager';
    ELSE _role := 'employee';
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;
END $$;
