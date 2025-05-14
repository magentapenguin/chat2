import { createClient } from '@supabase/supabase-js'
import { hCaptchaLoader } from '@hcaptcha/loader';
import '@hcaptcha/types'

await hCaptchaLoader();

hcaptcha.render(
    '.h-captcha',
    {
        sitekey: '10000000-0000-0000-0000-000000000001',
        theme: 'light',
    }
);

// Create a single supabase client for interacting with your database
const supabase = createClient('https://piukosdnirsgphzdyjan.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpdWtvc2RuaXJzZ3BoemR5amFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODc3MDIsImV4cCI6MjA2MjY2MzcwMn0.eIvvAayqroZzDpmlz21uRpllEAJhV_vrQtBJccxcvLw')


async function signInWithEmail(email) {
    const { data, error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {},
    })

}