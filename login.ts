import { supabase } from "./supabase-client";
import { gsap } from "gsap";
import { once, showToast, requireFinished } from "./utils";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { beginUsernameFlow, doIHaveUsername, getUsername, probablyHasUsername } from "./usernames";
import { posthog } from "./posthog";

gsap.registerPlugin(DrawSVGPlugin);

async function login(email: string, password: string, signUp = false) {
    const captcha = (window as any).hcaptcha.getResponse(); // @ts-ignore

    if (captcha) {
        if (signUp) {
            const { data, error } = await supabase.auth.signUp({
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
export async function checkLoginUser(fast: boolean = false) {
    // DANGER: Fast mode skips fetching user details and is easier to spoof.
    if (fast) {
        // If fast is true, we only check if the user is logged in without fetching user details
        const { data: { session } } = await supabase.auth.getSession();
        return session?.user;
    }
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

export function onAuthChange(callback: (loggedIn: boolean) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
        callback(!!session);
    });
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

const navNoUser = document.getElementById(
    "nav-nouser"
) as HTMLDivElement;
const navUser = document.getElementById(
    "nav-user"
) as HTMLDivElement;

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

requireFinished(async () => {
    const loggedIn = await checkLogin();
    document.body.classList.toggle("logged-in", loggedIn);
}, "Login flow initialized");

onAuthChange(async (loggedIn) => {
    navNoUser.hidden = loggedIn;
    navUser.hidden = !loggedIn;
    if (loggedIn) {
        const user = await checkLoginUser(true);
        if (user) {
            posthog.identify(user.id, {
                email: user.email,
                username: await getUsername(user.id),
            });
        }
    } else {
        posthog.reset();
    }
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
const loginCompleteMessage = document.getElementById(
    "login-complete-message"
) as HTMLDivElement;
const loginCompleteMessageNeedUsername = document.getElementById(
    "login-complete-message-need-username"
) as HTMLDivElement;
loginCompleteContinueButton.addEventListener("click", async () => {
    loginDialog.hidden = true;
    reset();
    if (!(await doIHaveUsername())) {
        beginUsernameFlow(); // Start the username flow after login completion
    }
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

once(() => {
    loginStep1Form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(loginStep1Form);

        const email = formData.get("email") as string;
        const password = formData.get("password") as string;
        const signUp = (event?.submitter as HTMLButtonElement | null)?.value === "signup";
        try {
            loginStep1Form.hidden = true;
            loginLoading.hidden = false;
            loginError.hidden = true;
            await login(email, password, signUp);
            loginLoading.hidden = true;
            loginComplete.hidden = false;
            gsap.fromTo(
                "#login-complete-svg path",
                { drawSVG: "0% 0%" },
                { drawSVG: "100% 0%", duration: 2, ease: "power2.inOut" }
            );
            if (probablyHasUsername) {
                loginCompleteMessageNeedUsername.hidden = true;
                loginCompleteMessage.hidden = false;
            }
        } catch (error) {
            loginStep1Form.hidden = false;
            console.error(
                `Error during ${signUp ? "signup" : "login"} step 1:`,
                error
            );
            loginError.hidden = false;
            loginError.innerText = "Error: " + error.message;
        } finally {
            loginLoading.hidden = true;
            (window as any).hcaptcha.reset(); // @ts-ignore
            loginStep1Form.reset();
        }
    });
}, "login-flow-loaded");
