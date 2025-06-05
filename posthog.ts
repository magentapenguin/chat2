import posthog from "posthog-js";

posthog.init("phc_FeriuDBIyqt9KKKHXDBSebZhzan9IPZzHjuN6JwrVzZ", {
    api_host: "https://us.i.posthog.com",
    defaults: "2025-05-24",
    session_recording: {
        recordBody: true,
        collectFonts: true,
    },
    opt_out_capturing_by_default: true,
});

const cookieBanner = document.getElementById("cookie-consent") as HTMLElement;
const acceptButton = document.getElementById(
    "accept-cookies",
) as HTMLButtonElement;
const rejectButton = document.getElementById(
    "decline-cookies",
) as HTMLButtonElement;

const isOptedIn = localStorage.getItem("posthog-opt-in");
if (isOptedIn === "true") {
    posthog.opt_in_capturing();
    cookieBanner.remove();
} else if (isOptedIn === "false") {
    cookieBanner.remove(); // remove the banner so the animation can't play
} else {
    cookieBanner.hidden = false;
}
acceptButton.addEventListener("click", () => {
    posthog.opt_in_capturing();
    localStorage.setItem("posthog-opt-in", "true");
    cookieBanner.hidden = true;
});
rejectButton.addEventListener("click", () => {
    posthog.opt_out_capturing();
    localStorage.setItem("posthog-opt-in", "false");
    cookieBanner.hidden = true;
});
export { posthog };
