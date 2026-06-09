"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/components/AuthProvider";
import { ELECTION_DATE_ESTIMATE } from "@/lib/site-config";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string };

const PRIMARY_LINKS: NavLink[] = [
  { href: "/prieskumy", label: "Prieskumy" },
  { href: "/predikcia", label: "Predikcia" },
  { href: "/kauzy", label: "Kauzy" },
  { href: "/poslanci", label: "Poslanci" },
  { href: "/koalicny-simulator", label: "Koaličný simulátor" },
  { href: "/tipovanie", label: "Tipovanie" },
  { href: "/povolebne-plany", label: "Povolebné plány" },
  { href: "/volebny-kalkulator", label: "Koho voliť?" },
];

const ALL_LINKS: NavLink[] = [
  { href: "/", label: "Domov" },
  ...PRIMARY_LINKS,
];

function readScoreCookie(): { total: number; rank: number } | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie.split("; ").find((c) => c.startsWith("volimto_score="));
  if (!raw) return null;

  try {
    return JSON.parse(decodeURIComponent(raw.split("=")[1])) as { total: number; rank: number };
  } catch {
    return null;
  }
}

function daysUntilElection(): number {
  return Math.ceil((ELECTION_DATE_ESTIMATE.getTime() - Date.now()) / 86_400_000);
}

function msUntilNextDay(): number {
  const nextMidnight = new Date();
  nextMidnight.setHours(24, 0, 0, 0);
  return Math.max(nextMidnight.getTime() - Date.now(), 1_000);
}

function SunIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
  );
}

function MoonIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </svg>
  );
}

function UserIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.25a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export default function Navbar({ initialDays }: { initialDays: number }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [score] = useState<{ total: number; rank: number } | null>(() => readScoreCookie());
  const [days, setDays] = useState(initialDays);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { user, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!userMenuOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDrawerOpen(false);
      setUserMenuOpen(false);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [pathname]);

  useEffect(() => {
    let interval: number | null = null;
    const syncTimeout = window.setTimeout(() => {
      setDays(daysUntilElection());
    }, 0);
    const timeout = window.setTimeout(() => {
      setDays(daysUntilElection());
      interval = window.setInterval(() => {
        setDays(daysUntilElection());
      }, 86_400_000);
    }, msUntilNextDay());

    return () => {
      window.clearTimeout(syncTimeout);
      window.clearTimeout(timeout);
      if (interval !== null) {
        window.clearInterval(interval);
      }
    };
  }, []);

  async function handleLogout() {
    await logout();
    setUserMenuOpen(false);
    setDrawerOpen(false);
    router.push("/");
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <header
      data-navbar-light
      style={{ viewTransitionName: "navbar" }}
      className="sticky top-0 z-50 bg-surface border-b-3 border-ink"
    >
      <div className="mx-auto flex h-nav items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* Logo + countdown */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/"
            className="logo-swap font-serif font-bold text-xl text-ink tracking-tight"
            aria-label="VolímTo — domov"
          >
            <span className="logo-en">VolímTo</span>
            <span aria-hidden className="logo-gr whitespace-nowrap pointer-events-none">πόλις</span>
          </Link>
          {days > 0 && (
            <div
              suppressHydrationWarning
              aria-label={`~${days} dní do volieb`}
              className="hidden size-nav-count pointer-events-none flex-col items-center justify-center bg-ink text-surface sm:flex"
            >
              <span className="text-sm font-bold leading-none">~{days}</span>
              <span className="mt-0.5 text-micro font-medium uppercase tracking-wide opacity-60">DNÍ</span>
            </div>
          )}
        </div>

        {/* Primary links — desktop */}
        <nav className="hidden lg:flex items-center flex-1 justify-center gap-0">
          {PRIMARY_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "whitespace-nowrap px-3 py-2 text-body-sm font-medium transition-colors",
                isActive(item.href)
                  ? "font-semibold text-ink"
                  : "text-text hover:bg-hover hover:text-ink"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-1 shrink-0 ml-auto lg:ml-0">
          {/* Theme toggle — visible on desktop */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Prepnúť na tmavý režim" : "Prepnúť na svetlý režim"}
            className="hidden lg:inline-flex p-2 text-ink hover:bg-hover transition-colors"
          >
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
          </button>

          {/* Auth — desktop (icon + popover) */}
          {!isLoading && (
            <div ref={userMenuRef} className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-label={user ? user.displayName : "Prihlásiť sa"}
                className="p-2 text-ink hover:bg-hover transition-colors"
              >
                <UserIcon />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1 w-56 bg-card border border-divider z-50"
                >
                  {user ? (
                    <>
                      <Link
                        href="/profil"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center justify-between px-3 py-2 text-sm font-medium text-text hover:text-ink hover:bg-hover transition-colors"
                      >
                        <span>{user.displayName}</span>
                        {score && (
                          <span className="text-caption font-mono opacity-60">
                            {score.total}b · #{score.rank}
                          </span>
                        )}
                      </Link>
                      <div className="border-t border-divider" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className="block w-full text-left px-3 py-2 text-sm font-medium text-text hover:text-ink hover:bg-hover transition-colors"
                      >
                        Odhlásiť sa
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/prihlasenie"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                        className="block px-3 py-2 text-sm font-medium text-text hover:text-ink hover:bg-hover transition-colors"
                      >
                        Prihlásiť sa
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label={drawerOpen ? "Zavrieť menu" : "Otvoriť menu"}
            aria-expanded={drawerOpen}
            className="lg:hidden p-2 text-ink hover:bg-hover transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {drawerOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <nav className="lg:hidden bg-card border-t border-divider">
          {ALL_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setDrawerOpen(false)}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`block px-4 py-3 text-base font-medium border-b border-divider transition-colors ${
                isActive(item.href)
                  ? "text-ink font-semibold bg-hover"
                  : "text-text hover:text-ink hover:bg-hover"
              }`}
            >
              {item.label}
            </Link>
          ))}

          {!isLoading && (
            <>
              {user ? (
                <>
                  <Link
                    href="/profil"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center justify-between px-4 py-3 text-base font-medium text-text hover:text-ink hover:bg-hover border-b border-divider transition-colors"
                  >
                    <span>{user.displayName}</span>
                    {score && (
                      <span className="text-xs font-mono opacity-60">
                        {score.total}b · #{score.rank}
                      </span>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-3 text-base font-medium text-text hover:text-ink hover:bg-hover border-b border-divider transition-colors"
                  >
                    Odhlásiť sa
                  </button>
                </>
              ) : (
                <Link
                  href="/prihlasenie"
                  onClick={() => setDrawerOpen(false)}
                  className="block px-4 py-3 text-base font-medium text-text hover:text-ink hover:bg-hover border-b border-divider transition-colors"
                >
                  Prihlásiť sa
                </Link>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => { toggleTheme(); setDrawerOpen(false); }}
            className="flex items-center gap-3 w-full px-4 py-3 text-base font-medium text-text hover:text-ink hover:bg-hover transition-colors"
          >
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
            <span>{theme === "light" ? "Tmavý režim" : "Svetlý režim"}</span>
          </button>
        </nav>
      )}
    </header>
  );
}
