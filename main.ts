import { createClient } from '@supabase/supabase-js'
import { hCaptchaLoader } from '@hcaptcha/loader';
import { checkLogin } from './login';

export const loaded = new Promise<void>((resolve) => {
    const checkLoaded = () => {
        if (document.readyState === 'complete') {
            resolve();
        } else {
            setTimeout(checkLoaded, 100);
        }
    };
    checkLoaded();
});

declare const hcaptcha: any;

await hCaptchaLoader();

hcaptcha.render(
    'login-captcha',
    {
        sitekey: '77327f6a-6a8a-46a6-a810-34245caa044c',
        theme: 'light',
    }
);

// Create a single supabase client for interacting with your database
export const supabase = createClient('https://piukosdnirsgphzdyjan.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpdWtvc2RuaXJzZ3BoemR5amFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODc3MDIsImV4cCI6MjA2MjY2MzcwMn0.eIvvAayqroZzDpmlz21uRpllEAJhV_vrQtBJccxcvLw')

const chat = document.getElementById('chat') as HTMLDivElement;