import z from 'zod';

export const TextMessage = z.object({
    type: z.literal('text'),
    content: z.string().max(500),
    sender: z.string().uuid(),
    timestamp: z.date({ coerce: true })
});
export const ErrorMessage = z.object({
    type: z.literal('error'),
    content: z.string(),
    timestamp: z.date({ coerce: true })
});
export const UserMessage = z.object({
    type: z.literal('user'),
    sender: z.string().uuid(),
    subtype: z.union([
        z.literal('join'),
        z.literal('leave'),
    ]),
    timestamp: z.date({ coerce: true })
});

export const Message = z.union([
    TextMessage,
    ErrorMessage,
    UserMessage
]);