export const tokenize = (input: string): string[] => input.toLowerCase().trim().split(/ +/);

export const userIdToMention = (userId: string): string => `<@${userId}>`;
