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
        { event: "*", schema: "public", table: "messages" },
        async (payload) => {
            console.log("New message received:", payload);
            if ((payload.new as dbTypes.Database["public"]["Tables"]["messages"]["Row"]).user_id === (await checkLoginUser())?.id) {
                return;
            }
            switch (payload.eventType) {
                case "INSERT": 
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
                    break;
                case "UPDATE":
                    // find the message in the chat and update it
                    console.log("Update event received:", payload);
                    const updatedMessage = row2Msg(
                        payload.new as dbTypes.Database["public"]["Tables"]["messages"]["Row"]
                    );
                    const messageElement = chat.querySelector('div.message[data-message-id="' + updatedMessage.id + '"]') as HTMLDivElement | null;
                    if (messageElement) {
                        const contentElement = messageElement.querySelector("span");
                        if (contentElement) {
                            contentElement.textContent = updatedMessage.content;
                        }
                        const userElement = messageElement.querySelector(".user") as HTMLSpanElement | null;
                        if (userElement) {
                            userElement.textContent = await getUserName(updatedMessage.user_id);
                            userElement.style.color = usernameColor(userElement.textContent!);
                        }
                        const timestampElement = messageElement.querySelector("time");
                        if (timestampElement) {
                            timestampElement.setAttribute("datetime", updatedMessage.timestamp);
                            timestampElement.innerHTML = humanize(updatedMessage.timestamp);
                        }
                    } else {
                        console.warn("Message to update not found in chat:", updatedMessage.id);
                    }

                    break;
                case "DELETE":
                    const deletedMessageId = (payload.old as dbTypes.Database["public"]["Tables"]["messages"]["Row"]).id;
                    const deletedMessageElement = chat.querySelector('div.message[data-message-id="' + deletedMessageId + '"]') as HTMLDivElement | null;
                    if (deletedMessageElement) {
                        deletedMessageElement.remove();
                    } else {
                        console.warn("Message to delete not found in chat:", deletedMessageId);
                    }
                    break;
                default:
                    // This should not happen, but just in case
                    console.error("Unknown event type:", (payload as { eventType: string }).eventType);
                    showToast({
                        title: "Error",
                        message: "Unknown event type received from database.",
                        type: "error",
                        duration: 5000,
                    });
                    break;
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
    messageElement.setAttribute("data-message-id", message.id);

    const userElement = document.createElement("strong");
    userElement.className = "user";
    userElement.textContent = await getUserName(message.user_id);
    userElement.style.color = usernameColor(userElement.textContent!);
    messageElement.appendChild(userElement);
    const timestampElement = document.createElement("time");
    timestampElement.setAttribute("datetime", message.timestamp);
    timestampElement.innerHTML = humanize(message.timestamp);
    messageElement.appendChild(timestampElement);

    const actions = document.createElement("div");
    actions.className = "message-actions";
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.title = "Delete";
    deleteButton.innerHTML = `<svg class="fa-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M170.5 51.6L151.5 80l145 0-19-28.4c-1.5-2.2-4-3.6-6.7-3.6l-93.7 0c-2.7 0-5.2 1.3-6.7 3.6zm147-26.6L354.2 80 368 80l48 0 8 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-8 0 0 304c0 44.2-35.8 80-80 80l-224 0c-44.2 0-80-35.8-80-80l0-304-8 0c-13.3 0-24-10.7-24-24S10.7 80 24 80l8 0 48 0 13.8 0 36.7-55.1C140.9 9.4 158.4 0 177.1 0l93.7 0c18.7 0 36.2 9.4 46.6 24.9zM80 128l0 304c0 17.7 14.3 32 32 32l224 0c17.7 0 32-14.3 32-32l0-304L80 128zm80 64l0 208c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-208c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0l0 208c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-208c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0l0 208c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-208c0-8.8 7.2-16 16-16s16 7.2 16 16z"/></svg>`;
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
    actions.appendChild(deleteButton);
    const editButton = document.createElement("button");
    editButton.className = "edit-button";
    editButton.title = "Edit";
    editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="fa-icon"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z"/></svg>`;
    editButton.addEventListener("click", async () => {
        const user = await checkLoginUser();
        if (!user || user.id !== message.user_id) {
            showToast({
                title: "Error",
                message: "You can only edit your own messages.",
                type: "error",
                duration: 5000,
            });
            return;
        }
        const newContent = prompt("Edit your message:", message.content);
        if (newContent === null || newContent.trim() === "") {
            return; // User cancelled or entered empty content
        }
        if (newContent.length > 500) {
            showToast({
                title: "Error",
                message: "Message is too long. Maximum length is 500 characters.",
                type: "error",
                duration: 5000,
            });
            return;
        }
        const { error } = await supabase
            .from("messages")
            .update({ content: newContent })
            .eq("id", message.id);
        if (error) {
            console.error("Error updating message:", error);
            showToast({
                title: "Error",
                message: "Error updating message. (" + error.message + ")",
                type: "error",
                duration: 5000,
            });
            return;
        }
        message.content = newContent;
        contentElement.textContent = newContent;
    });
    actions.appendChild(editButton);
    messageElement.appendChild(actions);
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