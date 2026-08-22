import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "customer";

export interface Profile {
  id: string;
  role: Role;
  full_name: string | null;
  duka_name: string | null;
}

/** Loads the signed-in user's profile, creating a customer profile on first visit. */
export async function loadProfile(): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, duka_name")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as Profile;

  const meta = (user.user_metadata ?? {}) as { full_name?: string; duka_name?: string };
  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      role: "customer",
      full_name: meta.full_name ?? null,
      duka_name: meta.duka_name ?? null,
    })
    .select("id, role, full_name, duka_name")
    .single();
  if (insertError) throw new Error(insertError.message);
  return created as Profile;
}

export const profileQuery = {
  queryKey: ["profile"],
  queryFn: loadProfile,
  staleTime: 60_000,
};

export function useProfile() {
  return useQuery(profileQuery);
}

export const homeFor = (role: Role | undefined) => (role === "admin" ? "/admin" : "/dashboard");

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return loadProfile();
}

export async function signUp(input: {
  email: string;
  password: string;
  full_name: string;
  duka_name: string;
}) {
  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth`,
      data: { full_name: input.full_name, duka_name: input.duka_name },
    },
  });
  if (error) throw new Error(error.message);
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  return loadProfile();
}
