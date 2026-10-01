import { useState } from 'react';
import type { WebVideo } from '../../engine/answers';
import { trustedUrl } from '../../ai/untrusted';
import { Collapse } from '../Collapse';
import { IconExternal, IconPlay } from '../Icons';

/** ID do vídeo (só IDs válidos viram capa e player). */
function videoId(url: string): string {
  try {
    const v = new URL(url).searchParams.get('v') ?? '';
    return /^[\w-]{6,20}$/.test(v) ? v : '';
  } catch {
    return '';
  }
}

/** Card compacto: capa pequena, título e descrição. Clicar abre o player dentro do card. */
export function VideoCard({ video }: { video: WebVideo }) {
  const id = videoId(video.url);
  const [play, setPlay] = useState(false);
  const [thumbOk, setThumbOk] = useState(true);
  if (!id || !trustedUrl(video.url)) return null;
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface-2/60 transition-colors duration-150 hover:border-muted/60">
      <div className="flex items-stretch gap-3 p-2">
        <button
          type="button"
          onClick={() => setPlay((p) => !p)}
          aria-expanded={play}
          aria-label={`${play ? 'Fechar' : 'Assistir'}: ${video.title}`}
          className="group relative aspect-video w-[104px] shrink-0 self-center overflow-hidden rounded-lg bg-surface sm:w-[148px]"
        >
          {thumbOk ? (
            <img
              src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`}
              alt=""
              loading="lazy"
              onError={() => setThumbOk(false)}
              className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
            />
          ) : null}
          <span className="absolute inset-0 grid place-items-center bg-black/10 transition-colors group-hover:bg-black/0">
            <span className="grid h-7 w-10 place-items-center rounded-lg bg-[#d8433a] text-white shadow-[0_4px_12px_-4px_rgb(0_0_0/0.6)] transition-transform duration-200 ease-out group-hover:scale-110">
              <IconPlay width={14} height={14} />
            </span>
          </span>
        </button>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-0.5">
          <button type="button" onClick={() => setPlay((p) => !p)} className="line-clamp-2 text-left text-[13.5px] leading-snug font-medium text-fg hover:underline">
            {video.title}
          </button>
          {video.description ? <p className="line-clamp-2 text-[12.5px] leading-snug text-muted">{video.description}</p> : null}
          <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted">
            <span className="font-mono">youtube.com</span>
            <a href={video.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-fg" aria-label={`Abrir no YouTube: ${video.title}`}>
              <IconExternal width={12} height={12} />
              abrir
            </a>
          </div>
        </div>
      </div>
      <Collapse open={play}>
        <div className="px-2 pb-2">
          <iframe
            className="aspect-video w-full rounded-lg border border-line"
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </Collapse>
    </div>
  );
}

/** Lista de vídeos (um ou vários). */
export function VideoList({ videos, title = 'Vídeos' }: { videos: WebVideo[]; title?: string }) {
  const valid = videos.filter((v) => videoId(v.url) && trustedUrl(v.url));
  if (!valid.length) return null;
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2">
      <p className="text-[13px] font-medium text-muted">
        {title} {valid.length > 1 ? <span className="font-mono text-[12px]">({valid.length})</span> : null}
      </p>
      {valid.map((v) => (
        <VideoCard key={v.url} video={v} />
      ))}
    </div>
  );
}
