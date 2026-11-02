import type { PropsWithChildren, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Clock3, Sparkles } from "lucide-react";

interface AuthPageProps extends PropsWithChildren {
  title: string;
  description: string;
  footer: ReactNode;
}

export function AuthPage({
  title,
  description,
  footer,
  children,
}: AuthPageProps) {
  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.9fr)]">
      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-[#211b3c] p-12 text-white lg:flex xl:p-16">
        <div className="pointer-events-none absolute -left-40 -top-40 size-[520px] rounded-full border border-white/[0.08]" />
        <div className="pointer-events-none absolute -left-16 -top-16 size-[360px] rounded-full border border-white/[0.08]" />
        <div className="pointer-events-none absolute -bottom-48 -right-36 size-[500px] rounded-full bg-primary/30 blur-3xl" />
        <Link to="/login" className="relative flex w-fit items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/10">
            <Clock3 className="size-5" />
          </span>
          <span className="text-xl font-bold tracking-tight">tempo</span>
        </Link>

        <div className="relative max-w-lg">
          <span className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-white/10">
            <Sparkles className="size-6 text-violet-200" />
          </span>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-200">
            A calmer way to work
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.12] tracking-tight xl:text-5xl">
            Give your best work the space it deserves.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-white/65">
            Make focus a habit, one intentional session at a time.
          </p>
        </div>

        <p className="relative text-xs text-white/45">
          Less rush. More meaningful progress.
        </p>
      </section>

      <section className="flex min-h-screen flex-col">
        <header className="flex h-16 items-center px-5 sm:px-8 lg:justify-end lg:px-10">
          <Link to="/login" className="flex items-center gap-2 font-bold lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Clock3 className="size-4" />
            </span>
            tempo
          </Link>
          <p className="ml-auto text-xs text-muted-foreground lg:ml-0">
            A little more focus, a little less noise.
          </p>
        </header>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[410px]">
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </div>
            {children}
            <div className="mt-7 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          </div>
        </div>

        <footer className="px-5 pb-5 text-center text-[11px] text-muted-foreground sm:px-8">
          By continuing, you agree to use your time with intention.
        </footer>
      </section>
    </main>
  );
}
