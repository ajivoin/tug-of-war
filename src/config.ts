const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const config = {
  token: required('DISCORD_TOKEN'),
  prefix: process.env.PREFIX ?? 't?',
  dataFile: process.env.DATA_FILE ?? 'data.json',
} as const;
