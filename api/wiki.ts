import { handleWiki } from './_lib/wiki';

export const config = { runtime: 'edge' };

export default function handler(req: Request): Promise<Response> {
  return handleWiki(req);
}
