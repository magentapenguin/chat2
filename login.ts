import { supabase } from "./main";
import { gsap } from "gsap";
    
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";

gsap.registerPlugin(DrawSVGPlugin);


async function login(email: string, username: string) {
    const captcha = (window as any).hcaptcha.getResponse(); // @ts-ignore

    if (captcha) {
        const { data, error } = await supabase.auth.signInWithOtp({
            email: email,
            options: {
                captchaToken: captcha,
                emailRedirectTo: location.origin+location.pathname,
                data: {
                    username: username
                },
            }
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

const loginDialog = document.getElementById("login-flow") as HTMLDivElement;
const loginButton = document.getElementById("login-button") as HTMLButtonElement;
loginButton.addEventListener("click", () => {
    loginDialog.hidden = false;
});
loginDialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        loginDialog.hidden = true;
    }
});

const loginStep1Form = document.getElementById("login-form-1") as HTMLFormElement;
const loginError = document.getElementById("login-error-message") as HTMLDivElement;
const loginLoading = document.getElementById("login-loading") as HTMLDivElement;
const loginComplete = document.getElementById("login-complete") as HTMLDivElement;

loginStep1Form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginStep1Form);
    const email = formData.get("email") as string;
    const username = formData.get("username") as string;
    try {
        loginStep1Form.hidden = true;
        loginLoading.hidden = false;
        await login(email, username);
        loginLoading.hidden = true;
        loginComplete.hidden = false;
        gsap.fromTo(
            '#login-complete-svg path',
            { drawSVG: '0% 0%' },
            { drawSVG: '100% 0%', duration: 2, ease: "power2.inOut" }
        );
                
    } catch (error) {
        loginStep1Form.hidden = false;
        console.error("Error during login step 1:", error);
        loginError.hidden = false;
        loginError.innerText = "Error: " + error.message;
    } finally {
        loginLoading.hidden = true;
    }
});

