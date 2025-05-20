import { hCaptchaLoader } from '@hcaptcha/loader';
import { customAlphabet } from 'nanoid';
import { checkLoginUser, checkLogin } from './login';
import * as types from './types';
import { showToast } from './utils';
import { supabase, Types as dbTypes } from './supabase-client';

export const nanoid = customAlphabet('1234567890abcdef', 30);


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

    const { data, error } = await supabase
        .from('messages')
        .insert([
            { data: message, id: nanoid() }
        ]);
    if (error) {
        console.error('Error inserting message:', error);
        showToast({
            title: 'Error',
            message: 'Error inserting message into database. (' + error.message + ')',
            type: 'error',
            duration: 5000,
        });
        return;
    }
});

channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
    try {
        const message = row2Msg(payload as unknown as dbTypes.Database['public']['Tables']['messages']['Row']);
        addMessage(message);
    } catch (error) {
        console.error('Error parsing message:', error);
        showToast({
            title: 'Error',
            message: 'Error parsing message from database. (' + error.message + ')',
            type: 'error',
            duration: 5000,
        });
    }
});

function row2Msg(row: dbTypes.Database['public']['Tables']['messages']['Row']) {
    const message = row.data as unknown;
    if (typeof message !== 'object' || message === null) {
        throw new Error('Invalid message format');
    }
    const id = row.id;
    const user = row.user_id;
    message['id'] = id;
    message['user_id'] = user;
    const parsedMessage = types.Message.safeParse(message);
    if (parsedMessage.success) {
        return parsedMessage.data;
    } else {
        throw new Error('Invalid message format');
    }
}

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
        const parsedMessage = types.Message.safeParse(message);
        if (parsedMessage.success) {
            const messageData = parsedMessage.data;
            addMessage(messageData);
        } else {
            console.error('Invalid message format:', parsedMessage.error);
        }
    });
}

checkLogin().then((loggedIn) => {
    const chatFieldset = chatForm.querySelector('fieldset') as HTMLFieldSetElement;
    chatFieldset.disabled = !loggedIn;
});