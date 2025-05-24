import { supabase } from "./supabase-client";

export async function beginUsernameFlow() {
    // TODO
}

export async function doIHaveUsername(): Promise<boolean> {
    const { data: user, error } = await supabase.auth.getUser();
    if (error) {
        console.error("Error getting user:", error);
        return false;
    }
    if (user) {
        // Check if the user has a username
        const { data: username, error: usernameError } = await supabase
            .from("usernames")
            .select("username")
            .eq("user_id", user.user.id)
            .single();
        if (usernameError) {
            console.error("Error checking username:", usernameError);
            return false;
        }
        if (username) {
            // User has a username
            return true;
        }
    }
    return false;
}