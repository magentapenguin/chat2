import { createClient } from '@supabase/supabase-js'
import { hCaptchaLoader } from '@hcaptcha/loader';
import { checkLoginUser } from './login';
import * as types from './types';
import { showToast } from './utils';

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

supabase.realtime.connect();

const channel = supabase.realtime.channel('messages', {
    config: {
        broadcast: {
            self: true,
        },
    },
});

const chat = document.getElementById('chat') as HTMLDivElement;
const chatForm = document.getElementById('chat-form') as HTMLFormElement;

chatForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(chatForm);
    const message = formData.get('message') as string;
    const isSneaky = (formData.get('sneaky') ?? false) as boolean; // Should we send this to a database

    const user = await checkLoginUser();

    if (!user) {
        showToast({
            title: 'Error',
            message: 'You must be logged in to send messages.',
            type: 'error',
            duration: 5000,
        });
        return;
    }
    if (message.length > 500) {
        showToast({
            title: 'Error',
            message: 'Message is too long. Maximum length is 500 characters.',
            type: 'error',
            duration: 5000,
        });
        return;
    }
    if (message.length === 0) {
        showToast({
            title: 'Error',
            message: 'Message cannot be empty.',
            type: 'error',
            duration: 5000,
        });
        return;
    }

    const messageData = {
        type: 'text',
        content: message,
        sender: user?.id,
        timestamp: new Date(),
    }

    if (!isSneaky) {
        const { data, error } = await supabase
            .from('messages')
            .insert([
                { message: message }
            ]);
        if (error) {
            console.error('Error inserting message:', error);
            return;
        }
    }
    // Broadcast the message to all clients
    await channel.send({
        type: 'broadcast',
        event: 'new-message',
        payload: {
            new: messageData,
        },
    });

});

channel.on('broadcast', { event: 'new-message' }, (payload) => {
    const message = payload.new;
    const parsedMessage = types.Message.safeParse(message);
    if (parsedMessage.success) {
        const messageData = parsedMessage.data;
        addMessage(messageData);
    } else {
        console.error('Invalid message format:', parsedMessage.error);
    }
});

function addMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    const userElement = document.createElement('strong');
    userElement.textContent = message.sender;
    messageElement.appendChild(userElement);
    messageElement.appendChild(document.createTextNode(': '));
    const contentElement = document.createElement('span');
    contentElement.textContent = message.content;
    messageElement.appendChild(contentElement);
    chat.appendChild(messageElement);
    chat.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(100);
if (error) {
    console.error('Error fetching messages:', error);
}
if (data) {
    data.forEach((message) => {
        const parsedMessage = types.Message.safeParse(message.message);
        if (parsedMessage.success) {
            const messageData = parsedMessage.data;
            addMessage(messageData);
        } else {
            console.warn('Invalid message format:', parsedMessage.error);
        }
    });
}