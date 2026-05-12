-- Allow authenticated users (including Supabase anonymous users) to manage
-- their own profile and read other members' display names.
-- Anonymous sessions from signInAnonymously() have is_anonymous=true but
-- still have a real auth.uid(), so these policies apply to them identically.

-- Any authenticated user can read profiles (needed for plan member lists,
-- comment author names, etc.)
create policy "Authenticated users can read profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- Users can only insert their own profile row
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid()::text = uid);

-- Users can only update their own profile row
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid()::text = uid)
  with check (auth.uid()::text = uid);
