import { Thumb } from "@/components/shared/thumb";
import { COVER_BAND } from "@/lib/labels";
import type { CoverBand, CoverStyle } from "@/types";

/** The band's torn bottom edge, biting into the picture. */
const TEAR =
  "M0 0H100V3L97 4.6 94 2.8 90 5 87 3.2 83 4.8 80 2.6 76 5.2 72 3 69 4.4 65 2.7 61 5 58 3.1 54 4.7 50 2.9 47 5.1 43 3.3 40 4.5 36 2.6 32 4.9 29 3 25 5.2 21 2.8 18 4.6 14 3.2 10 5 7 2.7 3 4.4 0 3Z";

/**
 * The title's size, in cqw: the site's arithmetic (`ComicCover` there). Its
 * capitals run to 0.47em, a line has 76cqw, and the band about 36cqw of height
 * under the plate (42 with none). Largest first, from the frame's 18.2.
 */
function titleSize(title: string, room: number): number {
  for (let size = 18.2; size > 6.8; size *= 0.9) {
    const perLine = 76 / (0.47 * size);
    let lines = 0;
    let fits = true;
    for (const text of title.split("\n")) {
      let used = 0;
      lines++;
      for (const word of text.split(/\s+/).filter(Boolean)) {
        if (word.length > perLine) fits = false;
        if (used && used + 1 + word.length > perLine) {
          lines++;
          used = word.length;
        } else used += (used ? 1 : 0) + word.length;
      }
    }
    if (fits && lines * 0.78 * size <= room) return size;
  }
  return 6.8;
}

/**
 * The cover as the site draws it, near enough to choose by. Titled: the band
 * over the top, the volume plate and title in Teko, a torn edge into the
 * picture below it. The site's own tear is finer; the rest is to scale.
 */
export function CoverPreview({ src, style, title, volume, band }: { src: string; style: CoverStyle; title: string; volume: string; band: CoverBand }) {
  const colours = COVER_BAND[band];
  if (style === "full") {
    return (
      <div className="relative aspect-[410/562] w-full overflow-hidden rounded-md bg-muted">
        <Thumb src={src} alt="" fill sizes="240px" className="object-cover" />
      </div>
    );
  }

  return (
    <div className="@container relative aspect-[410/562] w-full overflow-hidden rounded-md" style={{ backgroundColor: colours.hex }}>
      <div className="absolute inset-x-0 bottom-0 h-[57.3%] bg-[#12181b]">
        <Thumb src={src} alt="" fill sizes="240px" className="object-cover object-top" />
      </div>
      <svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden className="absolute inset-x-0 top-[41.5%] h-[3.5%] w-full">
        <path d={TEAR} fill={colours.hex} />
      </svg>
      <div className="relative px-[9.9%] pt-[10.7%]">
        {volume && (
          <span className="inline-block px-[4.5cqw] py-[1.9cqw] font-display text-[2.7cqw] leading-none font-bold tracking-[0.08em] text-black" style={{ backgroundColor: colours.chip }}>
            {volume}
          </span>
        )}
        <p
          className="mt-[2.4cqw] font-display leading-[0.72] font-semibold tracking-[-0.03em] break-words text-[#fbfbfb] uppercase"
          style={{ fontSize: `${titleSize(title, volume ? 36 : 42)}cqw` }}
        >
          {title.split("\n").map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </p>
      </div>
      <p className="absolute bottom-[4%] left-[9.9%] text-[2.7cqw] leading-none text-white/80">Goondu Games X Partner</p>
    </div>
  );
}
