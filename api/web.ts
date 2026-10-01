import { handleWeb } from './_lib/web';

export const config = { runtime: 'edge' };

export default function handler(req: Request): Promise<Response> {
  return handleWeb(req, { key: process.env.OPENROUTER_API_KEY });
}
