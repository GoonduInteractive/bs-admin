import Image from "next/image";

/**
 * Sign-in shell: the site's entry-screen ground on the left, carrying the
 * game's logo and key art, and a plain white work surface for the form.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-entry text-white lg:flex lg:flex-col">
        <div className="relative z-10 flex flex-1 flex-col justify-between p-12">
          <Image
            src="/assets/brand/beyond-service-logo.png"
            alt="Beyond Service"
            width={176}
            height={63}
            priority
            className="h-auto w-44"
          />

          <div className="max-w-md">
            <p className="font-display text-sm tracking-[0.3em] text-signal uppercase">Command centre</p>
            <h2 className="mt-2 font-display text-6xl leading-[0.9] font-semibold uppercase">
              Ascend. Survive.
              <br />
              Compete.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Run the store, publish the comics and referee the tournaments of Trial of the Gods,
              all from one place.
            </p>
          </div>

          <Image
            src="/assets/brand/goondu-logo.png"
            alt="Goondu Games Studio"
            width={128}
            height={18}
            className="h-auto w-32 opacity-80"
          />
        </div>

        <Image
          src="/assets/brand/trial-of-the-gods.png"
          alt=""
          fill
          sizes="55vw"
          className="object-cover object-center opacity-35 mix-blend-screen"
        />
        <div aria-hidden className="absolute inset-0 bg-linear-to-t from-ink via-ink/40 to-transparent" />
      </aside>

      <main className="flex flex-col bg-card">
        <div className="flex items-center justify-between p-6 lg:hidden">
          <div className="rounded-md bg-ink px-3 py-2">
            <Image
              src="/assets/brand/beyond-service-logo.png"
              alt="Beyond Service"
              width={96}
              height={34}
              priority
              className="h-auto w-24"
            />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="p-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Goondu Games Studio · Authorised staff only
        </p>
      </main>
    </div>
  );
}
