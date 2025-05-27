export interface ToastOpts {
    title: string;
    message: string;
    type: "success" | "error" | "info" | "warning";
    duration?: number;
    onClose?: () => void;
    onClick?: () => void;
}
export function showToast(opts: ToastOpts) {
    let toastContainer = document.querySelector(".toast-container");
    if (!toastContainer) {
        toastContainer = document.createElement("div");
        toastContainer.className = "toast-container";
        toastContainer.ariaLive = "polite";
        toastContainer.ariaAtomic = "true";
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${opts.type}`;
    toast.innerHTML = `
        <strong>${opts.title} <div class="close"></div></strong>
        <p>${opts.message}</p>
    `;
    toastContainer.appendChild(toast);

    if (opts.onClick) {
        toast.addEventListener("click", opts.onClick);
    }

    if (opts.duration) {
        setTimeout(() => {
            animateElement(
                toast,
                [
                    { opacity: 1, transform: "translateX(0)" },
                    { opacity: 0, transform: "translateX(-100%)" },
                ],
                {
                    duration: 300,
                    easing: "ease-in-out",
                    fill: "forwards",
                }
            ).then(() => {
                toast.remove();
                if (opts.onClose) {
                    opts.onClose();
                }
            });
        }, opts.duration);
    }
    const closeButton = toast.querySelector(".close");
    if (closeButton) {
        closeButton.addEventListener("click", (e) => {
            e.stopPropagation();
            animateElement(
                toast,
                [
                    { opacity: 1, transform: "translateX(0)" },
                    { opacity: 0, transform: "translateX(-100%)" },
                ],
                {
                    duration: 300,
                    easing: "ease-in-out",
                    fill: "forwards",
                }
            ).then(() => {
                toast.remove();
                if (opts.onClose) {
                    opts.onClose();
                }
            });
        });
    }
}

export function animateElement(
    element: HTMLElement,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions
) {
    const shouldAnimate = window.matchMedia(
        "(prefers-reduced-motion: no-preference)"
    ).matches;
    if (shouldAnimate) {
        const animation = element.animate(keyframes, options);
        return new Promise((resolve) => {
            animation.onfinish = () => {
                resolve(true);
            };
        });
    } else {
        return Promise.resolve(false);
    }
}
export const cyrb53 = (str: string, seed = 0): number => {
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
export function humanize(date: string | Date): string {
    if (typeof date === "string") {
        date = new Date(date);
    }
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
}

export const loaded = new Promise<void>((resolve) => {
    if (document.readyState === "complete" || document.readyState === "interactive") {
        resolve();
    } else {
        document.addEventListener("DOMContentLoaded", () => resolve());
    }
});

let calls = {};
export const once = (func: Function, id: string) => {
    if (calls[id]) {
        return;
    }
    calls[id] = true;
    func();
}

export function resetOnce(id: string) {
    delete calls[id];
}


let finished = 0;
let total = 0;
const onAllFinishedCallbacks: (() => void)[] = [];
export function onAllFinished(callback: () => void) {
    onAllFinishedCallbacks.push(callback);
}

export function requireFinished(
    callback: (done: () => void) => void,
) {
    total++;
    try {
        callback(() => {
            finished++;
            if (finished === total) {
                onAllFinishedCallbacks.forEach((cb) => cb());
                onAllFinishedCallbacks.length = 0; // Clear the callbacks
            }
        });
    } catch (error) {
        finished++;
        console.error("Error in requireFinished callback:", error);
    }
}
export function requireFinishedAsync(
    callback: () => Promise<void>,
) {
    total++;
    callback()
        .then(() => {
            finished++;
            if (finished === total) {
                onAllFinishedCallbacks.forEach((cb) => cb());
                onAllFinishedCallbacks.length = 0; // Clear the callbacks
            }
        })
        .catch((error) => {
            finished++;
            console.error("Error in requireFinishedAsync callback:", error);
        });
}


export function resetFinished() {
    finished = 0;
    total = 0;
}

