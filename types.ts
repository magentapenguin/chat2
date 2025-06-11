declare global {
    interface ImportMeta {
        env: {
            DEV: boolean;
            PROD: boolean;
            VITE_BUILD_SHA: string;
            VITE_BUILD_DATE: string;
        };
    }
}
