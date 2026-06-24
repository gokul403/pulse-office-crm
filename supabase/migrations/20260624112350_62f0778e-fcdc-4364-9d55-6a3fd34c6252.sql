
-- Force-reset passwords and confirm emails for all demo accounts.
DO $$
DECLARE
  _users TEXT[][] := ARRAY[
    ['admin@demo.com',    'Admin1234!'],
    ['manager@demo.com',  'Manager1234!'],
    ['employee1@demo.com','Employee1234!'],
    ['employee2@demo.com','Employee1234!'],
    ['employee3@demo.com','Employee1234!']
  ];
  _row TEXT[];
BEGIN
  FOREACH _row SLICE 1 IN ARRAY _users LOOP
    UPDATE auth.users
       SET encrypted_password = extensions.crypt(_row[2], extensions.gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           confirmation_token = '',
           recovery_token = '',
           email_change_token_new = '',
           email_change = '',
           updated_at = now()
     WHERE email = _row[1];
  END LOOP;

  -- Clean up the stale signup that's not in our hardcoded list
  DELETE FROM auth.users WHERE email = 'manager1@demo.com';
END $$;
