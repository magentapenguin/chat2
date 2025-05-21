import { hCaptchaLoader } from "@hcaptcha/loader";
import { customAlphabet } from "nanoid";
import { checkLoginUser, checkLogin } from "./login";
import { showToast } from "./utils";
import { supabase, Types as dbTypes } from "./supabase-client";

export const nanoid = customAlphabet("1234567890abcdef", 30);

export const loaded = new Promise<void>((resolve) => {
    const checkLoaded = () => {
        if (document.readyState === "complete") {
            resolve();
        } else {
            setTimeout(checkLoaded, 100);
        }
    };
    checkLoaded();
});

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

    const { error } = await supabase
        .from("messages")
        .insert([{ data: message, id: nanoid() }]);
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
});

channel.on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "messages" },
    (payload) => {
        console.log("New message received:", payload);
        try {
            const message = row2Msg(
                payload as unknown as dbTypes.Database["public"]["Tables"]["messages"]["Row"]
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
);

function row2Msg(row: dbTypes.Database["public"]["Tables"]["messages"]["Row"]) {
    const message = {
        id: row.id,
        content: row.data,
        sender: row.user_id,
        timestamp: new Date(row.timestamp).toLocaleString(),
    };
    return message;
}

const cyrb53 = (str: string, seed = 0): number => {
    let h1 = 0xdeadbeef ^ seed,
        h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

function humanize(date: string | Date): string {
    if (typeof date === "string") {
        date = new Date(date);
    }
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
}

function usernameColor(username: string, seed = 0): string {
    const hue = cyrb53(username, seed) % 360;
    return `hsl(${hue}, 50%, 50%)`;
}

async function getUserName(userId: string) {
    const { data, error } = await supabase
        .from("usernames")
        .select("username")
        .eq("user_id", userId)
        .single();
    if (error) {
        console.warn("Error fetching username:", error);
        return userId;
    }
    if (data) {
        return data.username;
    }
    return userId;
}

async function addMessage(message) {
    const messageElement = document.createElement("div");
    messageElement.className = "message";
    const userElement = document.createElement("strong");
    userElement.style.color = usernameColor(message.sender);
    userElement.textContent = await getUserName(message.sender);
    messageElement.appendChild(userElement);
    const timestampElement = document.createElement("time");
    timestampElement.setAttribute("datetime", message.timestamp);
    timestampElement.innerHTML = humanize(message.timestamp);
    messageElement.appendChild(timestampElement);
    const contentElement = document.createElement("span");
    contentElement.textContent = message.content;
    messageElement.appendChild(contentElement);
    chat.appendChild(messageElement);
    chat.scrollIntoView({ behavior: "smooth", block: "end" });
}

const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(100);
if (error) {
    console.error("Error fetching messages:", error);
}
if (data) {
    data.forEach((message) => {
        const parsedMessage = row2Msg(message);
        addMessage(parsedMessage);
    });
}

checkLogin().then((loggedIn) => {
    const chatFieldset = chatForm.querySelector(
        "fieldset"
    ) as HTMLFieldSetElement;
    chatFieldset.disabled = !loggedIn;
});
