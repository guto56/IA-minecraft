import { handleChat } from './_lib/chat';

export const config = { runtime: 'edge' };

export default function handler(req: Request): Promise<Response> {
  return handleChat(req, { key: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL });
}
