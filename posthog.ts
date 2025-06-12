declare global {
  interface ImportMeta {
    env: {
      DEV: boolean;
      // other environment variables can be added here
    };
  }
}

import posthog from "posthog-js";
import { once } from './utils.ts';
once(() => {
    posthog.init("phc_FeriuDBIyqt9KKKHXDBSebZhzan9IPZzHjuN6JwrVzZ", {
        api_host: "https://us.i.posthog.com",
        defaults: "2025-05-24",
        session_recording: {
            recordBody: true,
            collectFonts: true,
        },
        debug: import.meta.env.DEV,
        opt_out_capturing_by_default: true,
        opt_out_persistence_by_default: true,
    });
}, "posthog-init");
export {
    posthog,
}
export default posthog;

export class CookieConsent extends HTMLElement {
    constructor() {
        super();
        this.innerHTML = `
            <div
                class="sticky bottom-2 left-0 z-50 not-xs:right-0 xs:max-w-60 flex flex-col gap-2 rounded-lg bg-white p-4 text-black shadow-lg dark:bg-gray-800 dark:text-white cookie-consent m-2 sm:text-sm"
            >
                <strong class="text-lg font-semibold"> Cookie Consent </strong>
                <div>
                    <p>
                        This site uses cookies to enhance your experience. By clicking
                        "Accept", you consent to the use of cookies.
                    </p>
                    <p>
                        For more information on how we use cookies and your privacy,
                        please read our
                        <a href="legal#privacy" class="text-blue-500 hover:underline"
                            >Privacy Policy</a>.
                    </p>
                </div>
                <div class="flex justify-end gap-2">
                    <button class="btn flex-1 font-extrabold accept-cookies">Accept</button>
                    <button class="btn danger decline-cookies">Decline</button>
                </div>
            </div>
        `;

        const cookieConsent = this.querySelector(
            ".cookie-consent",
        ) as HTMLDivElement;
        const acceptButton = this.querySelector(
            ".accept-cookies",
        ) as HTMLButtonElement;
        const rejectButton = this.querySelector(
            ".decline-cookies",
        ) as HTMLButtonElement;

        const isOptedIn = localStorage.getItem("posthog-opt-in");
        if (isOptedIn) {
            cookieConsent.hidden = true;
        }
        if (isOptedIn === "true") {
            posthog.opt_in_capturing();
        } else if (isOptedIn === "false") {
            posthog.opt_out_capturing();
        }
        acceptButton.addEventListener("click", () => {
            localStorage.setItem("posthog-opt-in", "true");
            posthog.opt_in_capturing();
            cookieConsent.hidden = true;
        });
        rejectButton.addEventListener("click", () => {
            localStorage.setItem("posthog-opt-in", "false");
            posthog.opt_out_capturing();
            cookieConsent.hidden = true;
        });
        cookieConsent.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                cookieConsent.hidden = true;
                localStorage.setItem("posthog-opt-in", "false");
                posthog.opt_out_capturing();
            }
        });
    }
}

customElements.define("cookie-consent", CookieConsent);