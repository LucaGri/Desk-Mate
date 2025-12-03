import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getAuthenticatedUser(authHeader: string | undefined): Promise<User | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("Auth: Missing or invalid Authorization header");
    return null;
  }

  const token = authHeader.substring(7);
  
  if (!token || token.length < 10) {
    console.log("Auth: Token too short or empty");
    return null;
  }
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.log("Auth: Supabase rejected token:", error.message);
      return null;
    }
    
    if (!user) {
      console.log("Auth: No user returned from Supabase");
      return null;
    }

    console.log("Auth: User verified:", user.id);
    return user;
  } catch (err) {
    console.error("Auth: Exception during token verification:", err);
    return null;
  }
}

export function createAuthenticatedClient(token: string): SupabaseClient {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}
