import { hCaptchaLoader } from "@hcaptcha/loader";
import { customAlphabet } from "nanoid";
import { checkLoginUser, checkLogin, onAuthChange } from "./login.ts";
import {
    cyrb53,
    humanize,
    isDarkMode,
    onAllFinished,
    once,
    requireFinished,
    showToast,
    shuffle,
} from "./utils";
import { supabase, Types as dbTypes } from "./supabase-client.ts";
import { getUsername } from "./usernames.ts";
import { posthog } from "./posthog.ts";
/// <reference types="@hcaptcha/types" />
/// <reference types="./types.ts" />



export const nanoid = customAlphabet("1234567890abcdef", 30);

const loadingMessages = shuffle([
    "Thinking about the meaning of life...",
    "Loading the secrets of the universe...",
    "Summoning the chat spirits...",
    "Consulting the ancient scrolls...",
    "Bugging the database for answers...",
    "Asking the AI for help...",
]);

const loadingMessageElement = document.getElementById(
    "loading-message",
) as HTMLDivElement;

let loadingIndex = 0;

function updateLoadingMessage() {
    loadingMessageElement.textContent =
        loadingMessages[loadingIndex % loadingMessages.length];
    loadingIndex++;
}

const interval = setInterval(() => {
    updateLoadingMessage();
}, 1500);
updateLoadingMessage();

onAllFinished(() => {
    const overlay = document.getElementById(
        "loading-overlay",
    ) as HTMLDivElement;
    overlay.hidden = true;
    clearInterval(interval);
});

once(() => {
    requireFinished(async () => {
        await hCaptchaLoader();

        hcaptcha.render("login-captcha", {
            sitekey: "77327f6a-6a8a-46a6-a810-34245caa044c",
            theme: isDarkMode() ? "dark" : "light",
            callback: () => {
                console.log("Captcha solved");
                posthog.capture("captcha_solve");
            },
            "error-callback": (error) => {
                console.error("Captcha error:", error);
                posthog.capture("captcha_error", {
                    error,
                });
            },
        });
    }, "Load hCaptcha");
}, "hcaptcha-init");

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
const notifSound = document.getElementById(
    "notification-sound",
) as HTMLAudioElement;

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
                message:
                    "Message is too long. Maximum length is 500 characters.",
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
                data[0] as dbTypes.Database["public"]["Tables"]["messages"]["Row"],
            );
            addMessage(message);
        }
    });

    channel
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "messages" },
            async (payload) => {
                console.log("New message received:", payload);
                if (
                    (
                        payload.new as dbTypes.Database["public"]["Tables"]["messages"]["Row"]
                    ).user_id === (await checkLoginUser())?.id
                ) {
                    return;
                }
                switch (payload.eventType) {
                    case "INSERT":
                        notifSound.play().catch((error) => {
                            console.error(
                                "Error playing notification sound:",
                                error,
                            );
                        });
                        try {
                            const message = row2Msg(
                                payload.new as dbTypes.Database["public"]["Tables"]["messages"]["Row"],
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
                            payload.new as dbTypes.Database["public"]["Tables"]["messages"]["Row"],
                        );
                        const messageElement = chat.querySelector(
                            'div.message[data-message-id="' +
                                updatedMessage.id +
                                '"]',
                        ) as HTMLDivElement | null;
                        if (messageElement) {
                            const contentElement =
                                messageElement.querySelector("span");
                            if (contentElement) {
                                contentElement.textContent =
                                    updatedMessage.content;
                            }
                            const userElement = messageElement.querySelector(
                                ".user",
                            ) as HTMLSpanElement | null;
                            if (userElement) {
                                userElement.textContent = await getUsername(
                                    updatedMessage.user_id,
                                );
                                userElement.style.color = usernameColor(
                                    userElement.textContent!,
                                );
                            }
                            const timestampElement =
                                messageElement.querySelector("time");
                            if (timestampElement) {
                                timestampElement.setAttribute(
                                    "datetime",
                                    updatedMessage.timestamp,
                                );
                                timestampElement.innerHTML = humanize(
                                    updatedMessage.timestamp,
                                );
                            }
                        } else {
                            console.warn(
                                "Message to update not found in chat:",
                                updatedMessage.id,
                            );
                        }

                        break;
                    case "DELETE":
                        const deletedMessageId = (
                            payload.old as dbTypes.Database["public"]["Tables"]["messages"]["Row"]
                        ).id;
                        const deletedMessageElement = chat.querySelector(
                            'div.message[data-message-id="' +
                                deletedMessageId +
                                '"]',
                        ) as HTMLDivElement | null;
                        if (deletedMessageElement) {
                            deletedMessageElement.remove();
                        } else {
                            console.warn(
                                "Message to delete not found in chat:",
                                deletedMessageId,
                            );
                        }
                        break;
                    default:
                        // This should not happen, but just in case
                        console.error(
                            "Unknown event type:",
                            (payload as { eventType: string }).eventType,
                        );
                        showToast({
                            title: "Error",
                            message:
                                "Unknown event type received from database.",
                            type: "error",
                            duration: 5000,
                        });
                        break;
                }
            },
        )
        .subscribe();

    requireFinished(async () => {
        const { data, error } = await supabase
            .from("messages")
            .select("*")
            .order("timestamp", { ascending: false })
            .limit(500);
        if (error) {
            console.error("Error fetching messages:", error);
        }
        if (data) {
            data.reverse();
            for (const message of data) {
                const parsedMessage = row2Msg(message);
                await addMessage(parsedMessage);
            }
        }
    }, "Load messages from database");
}, "main-chat-init");

function row2Msg(row: dbTypes.Tables<"messages">) {
    row.timestamp = new Date(row.timestamp).toISOString();
    return row;
}

export function usernameColor(username: string, seed = 2): string {
    let hue = cyrb53(username, seed) % (320 - 120);
    hue += 120;
    return `hsl(${hue}, 50%, 50%)`;
}

async function addMessage(message) {
    const messageElement = document.createElement("div");
    messageElement.className = "message";
    messageElement.setAttribute("data-message-id", message.id);

    const userElement = document.createElement("strong");
    userElement.className = "user";
    userElement.textContent = await getUsername(message.user_id);
    userElement.style.color = usernameColor(userElement.textContent!);
    messageElement.appendChild(userElement);
    const timestampElement = document.createElement("time");
    timestampElement.setAttribute("datetime", message.timestamp);
    timestampElement.innerHTML = humanize(message.timestamp);
    messageElement.appendChild(timestampElement);

    const user = await checkLoginUser(true);
    const actions = document.createElement("div");
    actions.className = "message-actions";
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.title = "Delete";
    deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon"><path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clip-rule="evenodd" /></svg>`;
    deleteButton.addEventListener("click", async () => {
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
    editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" /><path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" /></svg>`;
    editButton.addEventListener("click", async () => {
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
                message:
                    "Message is too long. Maximum length is 500 characters.",
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
    const contentElement = document.createElement("span");
    contentElement.textContent = message.content;
    if ((await checkLogin()) && message.user_id === user?.id) {
        messageElement.appendChild(actions);
    }
    messageElement.appendChild(contentElement);
    chat.appendChild(messageElement);
    chat.scrollTo({ top: chat.scrollHeight, behavior: "auto" });
}

requireFinished(async () => {
    const chatFieldset = chatForm.querySelector(
        "fieldset",
    ) as HTMLFieldSetElement;

    onAuthChange((loggedIn) => {
        chatFieldset.disabled = !loggedIn;
    });
}, "Chat init");

// Build Info
const buildInfo = document.getElementById("build-info") as HTMLDivElement;
if (import.meta.env.PROD) {
    buildInfo.textContent = `Build: ${import.meta.env.VITE_BUILD_SHA} (${import.meta.env.VITE_BUILD_DATE})`;
}