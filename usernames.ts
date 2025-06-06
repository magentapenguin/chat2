import { checkLogin, checkLoginUser } from "./login.ts";
import { usernameColor } from "./main.ts";
import { supabase, Types } from "./supabase-client.ts";
import { requireFinished, showToast, Dialog } from "./utils.ts";

const usernameDialogElem = document.getElementById(
    "you-need-a-username"
) as HTMLElement;
const usernameForm = document.getElementById(
    "username-form"
) as HTMLFormElement;
const usernameError = document.getElementById(
    "username-error-message"
) as HTMLDivElement;
const usernameInput = document.getElementById(
    "username-input"
) as HTMLInputElement;
usernameInput.addEventListener("input", () => {
    usernameInput.style.color = usernameColor(usernameInput.value);
    usernameInput.style.borderColor = usernameColor(usernameInput.value);
});

const usernameDialog = new Dialog(usernameDialogElem);

export let probablyHasUsername = false;
export let probableUsername: string | null = null;
// Check if the user has a username when the page loads
document.addEventListener("DOMContentLoaded", async () => {
    probablyHasUsername = await doIHaveUsername();
});

export async function beginUsernameFlow() {
    // Show the username dialog
    usernameDialog.show();
    usernameForm.reset(); // Reset the form
}

usernameForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(usernameForm);
    const username = formData.get("username") as string;
    const user = await checkLoginUser();
    usernameError.hidden = true;
    if (!user) {
        console.error("User is not logged in.");
        usernameError.textContent = "You must be logged in to set a username.";
        usernameError.hidden = false;
        return;
    }
    if (username.length < 3 || username.length > 20) {
        console.error("Username must be between 3 and 20 characters.");
        usernameError.textContent =
            "Username must be between 3 and 20 characters.";
        usernameError.hidden = false;
        console.log(
            username.length
        );
        return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        console.error(
            "Username can only contain letters, numbers, and underscores."
        );
        usernameError.textContent =
            "Username can only contain letters, numbers, and underscores.";
        usernameError.hidden = false;
        return;
    }
    // Check if the username already exists
    const { data: existingUsernames, error } = await supabase
        .from("usernames")
        .select("username")
        .eq("username", username);
    if (existingUsernames && existingUsernames.length > 0) {
        console.error("Username already exists.");
        usernameError.textContent =
            "Username already exists. Please choose another.";
        usernameError.hidden = false;
        return;
    }
    // Insert the new username into the database
    const { data, error: insertError } = await supabase
        .from("usernames")
        .insert([{ user_id: user.id, username }])
        .select();
    if (insertError) {
        console.error("Error inserting username:", insertError);
        usernameError.textContent = "Error setting username. Please try again.";
        usernameError.hidden = false;
        showToast({
            type: "error",
            title: "Error",
            message: "Error setting username. Please try again. (" +
                insertError.message + ")",
        });
        return;
    }
    console.log("Username set successfully:", data);
    // Username set successfully
    usernameForm.reset();
    usernameDialog.hide();
    probablyHasUsername = true; // Update the flag
    probableUsername = username; // Update the probable username
});

export async function doIHaveUsername(): Promise<boolean> {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        console.error("Error getting user:", error);
        return false;
    }
    const user = data.session?.user;
    if (user) {
        // Check if the user has a username
        const { data: usernameData, error: usernameError } = await supabase
            .from("usernames")
            .select("username")
            .eq("user_id", user.id)
            .single();
        if (usernameError) {
            console.error("Error checking username:", usernameError);
            return false;
        }
        if (usernameData) {
            let username = usernameData as Types.Tables<"usernames">;
            userCache[user.id] = username.username; // Cache the username
            // User has a username
            probablyHasUsername = true;
            probableUsername = username.username;
            return true;
        }
    }
    return false;
}

requireFinished(async () => {
    const hasUsername = await doIHaveUsername();
    if (!hasUsername && await checkLogin()) {
        // If the user does not have a username, show the dialog
        beginUsernameFlow();
    }
}, "Check Username Flow");let userCache: { [key: string]: string; } = {};
export async function getUsername(userId: string) {
    if (userCache[userId]) {
        return userCache[userId];
    }
    const { data, error } = await supabase
        .from("usernames")
        .select("username")
        .eq("user_id", userId)
        .single();
    if (error) {
        console.warn("Error fetching username:", error);
        userCache[userId] = userId;
        return userId;
    }
    if (data) {
        userCache[userId] = data.username;
        return data.username;
    }
    return userId;
}

