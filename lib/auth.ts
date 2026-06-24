"use client";

import { supabase } from "@/lib/supabase";
import { getCurrentUser, setCurrentUser, signInDemo, signOutLocal } from "@/lib/storage";
import type { AuthUser } from "@/lib/types";

export async function signInOrRegister(email: string, password: string, displayName: string) {
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      const user = {
        id: data.user.id,
        email: data.user.email || email,
        display_name: data.user.user_metadata.display_name || displayName || email.split("@")[0]
      } satisfies AuthUser;
      setCurrentUser(user);
      return user;
    }
    const signUp = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } }
    });
    if (signUp.error) throw signUp.error;
    if (signUp.data.user) {
      const user = {
        id: signUp.data.user.id,
        email: signUp.data.user.email || email,
        display_name: displayName || email.split("@")[0]
      } satisfies AuthUser;
      setCurrentUser(user);
      return user;
    }
  }
  return signInDemo(email, displayName);
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
  signOutLocal();
}

export function currentLocalUser() {
  return getCurrentUser();
}
