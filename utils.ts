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
