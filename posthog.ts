import posthog from "posthog-js";
import { Dialog, once } from './utils.ts';
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

const experimentsDialogElem = document.getElementById(
    "experiments-dialog",
) as HTMLDivElement;
const experimentsDialog = new Dialog(
    experimentsDialogElem
)
const experimentsList = document.getElementById(
    "experiments-list",
) as HTMLUListElement;
const experimentsButton = document.getElementById(
    "view-experiments",
) as HTMLButtonElement;
experimentsButton.addEventListener("click", () => {
    experimentsDialog.show();
});

    

let experimentsModified = false;
let changes: Record<string, boolean> = {};

const cancelButton = document.getElementById(
    "cancel-experiments",
) as HTMLButtonElement;
cancelButton.addEventListener("click", () => {
    if (experimentsModified) {
        const confirmDiscard = confirm("You have unsaved changes. Are you sure you want to discard them?");
        if (!confirmDiscard) return;
    }
    changes = {};
    experimentsModified = false;
    experimentsDialog.hide();
});
const saveButton = document.getElementById(
    "save-experiments",
) as HTMLButtonElement;
saveButton.addEventListener("click", () => {
    if (!experimentsModified) {
        alert("No changes to save.");
        return;
    }
experimentsList.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement;
    if (target.tagName.toLowerCase() === "input" && target.type === "checkbox") {
        const featureFlagKey = target.id.replace("exp-", "");
        experimentsModified = true;
        changes[featureFlagKey] = target.checked;
    }
});


posthog.getEarlyAccessFeatures((features) => {
    console.log("Early access features:", features);
    features.forEach((feature) => {
        const listItem = document.createElement("li");
        const enabled = posthog.isFeatureEnabled(feature.flagKey);
        listItem.className = "contents";
        listItem.innerHTML = `
            <label for="exp-${feature.flagKey}" class="block cursor-pointer rounded-sm bg-gray-100 p-2 dark:bg-gray-900 has-checked:bg-gray-200 dark:has-checked:bg-gray-800">
                <strong>${feature.name}</strong>
                <input type="checkbox" class="checkbox float-right m-0" ${enabled ? 'checked' : ''} id="exp-${feature.flagKey}" />
                <br>
                ${feature.description || "No description available."}
                <br>
                ${feature.documentationUrl ? `<a href="${feature.documentationUrl}" class="text-blue-500 hover:underline">Info</a>` : ""}
                <small class="text-gray-500 dark:text-gray-400">Status: ${feature.stage}</small>
            </label>
        `;
        experimentsList.appendChild(listItem);
    });
}, true, ['alpha', 'beta', 'general-availability'])