import { supabase } from "@/lib/supabase";

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.error("[fetchWithAuth] No session available");
    throw new Error("Not authenticated");
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
    });
    return response;
  } catch (error) {
    console.error("[fetchWithAuth] Fetch error:", error);
    throw error;
  }
}
