import { hCaptchaLoader } from "@hcaptcha/loader";
import { customAlphabet } from "nanoid";
import { checkLoginUser, checkLogin, onAuthChange } from "./login";
import { cyrb53, humanize, onAllFinished, once, requireFinishedAsync, showToast } from "./utils";
import { supabase, Types as dbTypes } from "./supabase-client";

export const nanoid = customAlphabet("1234567890abcdef", 30);

declare const hcaptcha: any;

await hCaptchaLoader();

hcaptcha.render("login-captcha", {
    sitekey: "77327f6a-6a8a-46a6-a810-34245caa044c",
    theme: "light",
});

supabase.realtime.connect();

const channel = supabase.realtime.channel("messages", {
    config: {
        broadcast: {
            self: true,
        },
    },
});

const chat = document.getElementById("chat") as HTMLDivElement;
const chatForm = document.getElementById("chat-form") as HTMLFormElement;
const notifSound = document.getElementById("notification-sound") as HTMLAudioElement;

once(async () => {
    chatForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(chatForm);
        const message = formData.get("message") as string;

        const user = await checkLoginUser();

        if (!user) {
            showToast({
                title: "Error",
                message: "You must be logged in to send messages.",
                type: "error",
                duration: 5000,
            });
            return;
        }
        if (message.length > 500) {
            showToast({
                title: "Error",
                message: "Message is too long. Maximum length is 500 characters.",
                type: "error",
                duration: 5000,
            });
            return;
        }
        if (message.length === 0) {
            showToast({
                title: "Error",
                message: "Message cannot be empty.",
                type: "error",
                duration: 5000,
            });
            return;
        }

        const { error, data } = await supabase
            .from("messages")
            .insert([{ content: message, id: nanoid() }])
            .select();
        if (error) {
            console.error("Error inserting message:", error);
            showToast({
                title: "Error",
                message:
                    "Error inserting message into database. (" +
                    error.message +
                    ")",
                type: "error",
                duration: 5000,
            });
            return;
        }
        if (data) {
            chatForm.reset();
            const message = row2Msg(
                data[0] as dbTypes.Database["public"]["Tables"]["messages"]["Row"]
            );
            addMessage(message);
        }
    });

    channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
            console.log("New message received:", payload);
            if ((payload.new as dbTypes.Database["public"]["Tables"]["messages"]["Row"]).user_id === (await checkLoginUser())?.id) {
                return;
            }
            notifSound.play().catch((error) => {
                console.error("Error playing notification sound:", error);
            });
            try {
                const message = row2Msg(
                    payload.new as dbTypes.Database["public"]["Tables"]["messages"]["Row"]
                );
                addMessage(message);
            } catch (error) {
                console.error("Error parsing message:", error);
                showToast({
                    title: "Error",
                    message:
                        "Error parsing message from database. (" +
                        error.message +
                        ")",
                    type: "error",
                    duration: 5000,
                });
            }
        }
    )
    .subscribe();

    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);

    if (error) {
        console.error("Error fetching messages:", error);
    }
    if (data) {
        requireFinishedAsync(async () => {
            data.reverse();
            for (const message of data) {
                const parsedMessage = row2Msg(message);
                await addMessage(parsedMessage);
            }
        });
    }
}, 'main-chat-init');

function row2Msg(row: dbTypes.Tables<'messages'>) {
    row.timestamp = new Date(row.timestamp).toISOString();
    return row;
}

export function usernameColor(username: string, seed = 2): string {
    let hue = cyrb53(username, seed) % (320 - 120);
    hue += 120;
    return `hsl(${hue}, 50%, 50%)`;
}

let userCache: { [key: string]: string } = {};

async function getUserName(userId: string) {
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

async function addMessage(message) {
    const messageElement = document.createElement("div");
    messageElement.className = "message";
    const userElement = document.createElement("strong");
    userElement.className = "user";
    userElement.textContent = await getUserName(message.user_id);
    userElement.style.color = usernameColor(userElement.textContent!);
    messageElement.appendChild(userElement);
    const timestampElement = document.createElement("time");
    timestampElement.setAttribute("datetime", message.timestamp);
    timestampElement.innerHTML = humanize(message.timestamp);
    messageElement.appendChild(timestampElement);
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button btn btn-danger";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", async () => {
        const user = await checkLoginUser();
        if (!user || user.id !== message.user_id) {
            showToast({
                title: "Error",
                message: "You can only delete your own messages.",
                type: "error",
                duration: 5000,
            });
            return;
        }
        const { error } = await supabase
            .from("messages")
            .delete()
            .eq("id", message.id);
        if (error) {
            console.error("Error deleting message:", error);
            showToast({
                title: "Error",
                message: "Error deleting message. (" + error.message + ")",
                type: "error",
                duration: 5000,
            });
            return;
        }
        messageElement.remove();
        showToast({
            title: "Success",
            message: "Message deleted successfully.",
            type: "success",
            duration: 5000,
        });
    });
    messageElement.appendChild(deleteButton);
    const contentElement = document.createElement("span");
    contentElement.textContent = message.content;
    messageElement.appendChild(contentElement);
    chat.appendChild(messageElement);
    chat.scrollTo({ top: chat.scrollHeight, behavior: 'auto' });
}

requireFinishedAsync(async () => {
    const chatFieldset = chatForm.querySelector(
        "fieldset"
    ) as HTMLFieldSetElement;

    onAuthChange((loggedIn) => {
        chatFieldset.disabled = !loggedIn;
    });
});

onAllFinished(() => {
    const overlay = document.getElementById("loading-overlay") as HTMLDivElement;
    overlay.hidden = true;
});