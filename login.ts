import { supabase } from "./supabase-client";
import { gsap } from "gsap";
import { showToast } from "./utils";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { beginUsernameFlow } from "./usernames";

gsap.registerPlugin(DrawSVGPlugin);

async function login(email: string, password: string) {
    const captcha = (window as any).hcaptcha.getResponse(); // @ts-ignore

    if (captcha) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
            options: {
                captchaToken: captcha,
            },
        });
        if (error) {
            throw error;
        } else {
            return data;
        }
    } else {
        throw new Error("Captcha not completed");
    }
}
export async function checkLogin() {
    const {
        data: { session },
        error,
    } = await supabase.auth.getSession();
    if (error) {
        console.error("Error getting session:", error);
        return false;
    }
    if (session) {
        return true;
    }
    return false;
}
export async function checkLoginUser() {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();
    if (error) {
        console.error("Error getting user:", error);
        return null;
    }
    if (user) {
        return user;
    }
    return null;
}

const loginDialog = document.getElementById("login-flow") as HTMLDivElement;
const loginButton = document.getElementById(
    "login-button"
) as HTMLButtonElement;
const logoutButton = document.getElementById(
    "logout-button"
) as HTMLButtonElement;
const backButton = document.getElementById(
    "back-to-login"
) as HTMLButtonElement;

const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Error signing out:", error);
        showToast({
            title: "Error signing out",
            message: error.message,
            type: "error",
            duration: 5000,
        });
    }
};

backButton.addEventListener("click", () => {
    loginStep1Form.hidden = false;
    loginError.hidden = true;
    loginLoading.hidden = true;
    loginComplete.hidden = true;
    (window as any).hcaptcha.reset(); // @ts-ignore
    loginStep1Form.reset();
});

logoutButton.addEventListener("click", async () => {
    await logout();
});

checkLogin().then((loggedIn) => {
    logoutButton.hidden = !loggedIn;
    loginButton.hidden = loggedIn;
});

loginButton.addEventListener("click", () => {
    loginDialog.hidden = false;
});
loginDialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        loginDialog.hidden = true;
    }
});

const loginStep1Form = document.getElementById(
    "login-form-1"
) as HTMLFormElement;
const loginError = document.getElementById(
    "login-error-message"
) as HTMLDivElement;
const loginLoading = document.getElementById("login-loading") as HTMLDivElement;
const loginComplete = document.getElementById(
    "login-complete"
) as HTMLDivElement;
const loginCloseButton = loginDialog.querySelector(
    ".close"
) as HTMLButtonElement;
const loginCompleteContinueButton = document.getElementById(
    "login-complete-continue"
) as HTMLButtonElement;
loginCompleteContinueButton.addEventListener("click", () => {
    loginDialog.hidden = true;
    reset();
    beginUsernameFlow(); // Start the username flow after login completion
});
loginCloseButton.addEventListener("click", () => {
    loginDialog.hidden = true;
});

function reset() {
    loginDialog.hidden = true;
    loginStep1Form.hidden = false;
    loginError.hidden = true;
    loginLoading.hidden = true;
    loginComplete.hidden = true;
    (window as any).hcaptcha.reset(); // @ts-ignore
    loginStep1Form.reset();
}

loginStep1Form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginStep1Form);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    try {
        loginStep1Form.hidden = true;
        loginLoading.hidden = false;
        loginError.hidden = true;
        await login(email, password);
        loginLoading.hidden = true;
        loginComplete.hidden = false;
        gsap.fromTo(
            "#login-complete-svg path",
            { drawSVG: "0% 0%" },
            { drawSVG: "100% 0%", duration: 2, ease: "power2.inOut" }
        );
    } catch (error) {
        loginStep1Form.hidden = false;
        console.error("Error during login step 1:", error);
        loginError.hidden = false;
        loginError.innerText = "Error: " + error.message;
    } finally {
        loginLoading.hidden = true;
        (window as any).hcaptcha.reset(); // @ts-ignore
        loginStep1Form.reset();
    }
});
