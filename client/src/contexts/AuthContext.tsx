import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Profile } from "@/lib/supabase-types";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileError: Error | null;
  refreshProfile: () => Promise<Profile | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<Error | null>(null);

  const initialLoadDone = useRef(false);
  const fetchingRef = useRef(false);

  const fetchProfile = useCallback(
    async (userId: string, userEmail?: string, userName?: string) => {
      try {
        setProfileError(null);
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            const { data: currentUser } = await supabase.auth.getUser();
            const email = userEmail || currentUser.user?.email || "";
            const fullName =
              userName || currentUser.user?.user_metadata?.full_name || "";

            const { data: newProfile, error: insertError } = await supabase
              .from("profiles")
              .insert({
                id: userId,
                email: email,
                full_name: fullName,
                onboarding_completed: false,
              })
              .select()
              .single();

            if (insertError) {
              if (insertError.code !== "23505") {
                setProfileError(new Error(insertError.message));
                setProfile(null);
                return null;
              }
              const { data: existingProfile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .single();
              setProfile(existingProfile);
              return existingProfile;
            }

            setProfile(newProfile);
            return newProfile;
          }

          setProfileError(new Error(error.message));
          setProfile(null);
          return null;
        }

        setProfile(profileData);
        return profileData;
      } catch (error) {
        const err =
          error instanceof Error ? error : new Error("Failed to fetch profile");
        setProfileError(err);
        setProfile(null);
        return null;
      }
    },
    [],
  );

  const refreshProfile = useCallback(async () => {
    if (user) {
      return await fetchProfile(user.id);
    }
    return null;
  }, [user, fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setProfileError(null);
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await fetchProfile(currentUser.id);
        }
      } catch (error) {
        console.error("Auth init error:", error);
      } finally {
        if (mounted) {
          setLoading(false);
          initialLoadDone.current = true;
          fetchingRef.current = false;
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip if not mounted or still doing initial load
      if (!mounted || !initialLoadDone.current) {
        return;
      }

      // Skip if already fetching to prevent race conditions
      if (fetchingRef.current) {
        return;
      }

      // IGNORE token refresh events - session is still valid, no action needed
      if (event === "TOKEN_REFRESHED") {
        if (session?.user) {
          setUser(session.user);
        }
        return;
      }

      // Handle sign out
      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        setProfileError(null);
        return;
      }

      // Handle sign in
      if (event === "SIGNED_IN" && session?.user) {
        fetchingRef.current = true;
        setUser(session.user);

        try {
          await fetchProfile(session.user.id);
        } catch (error) {
          console.error("Error fetching profile on sign in:", error);
        } finally {
          fetchingRef.current = false;
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileError,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
