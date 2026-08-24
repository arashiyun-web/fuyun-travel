'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GEO_BASE, GEO_LOCALES, GEO_SECTION_MAP, type GeoLocale, type GeoSection } from '@/lib/geo/locales';

/**
 * Top-left language switcher (absolute; never enters layout flow).
 *
 * Anti-404 logic: the current page is resolved to one of the 5 "core" GEO
 * sections (home / about / airport / charter / jiufen). Clicking a locale
 * jumps to that locale's version of the SAME section if it exists, otherwise
 * to that locale's home page. This way the switcher can NEVER produce a 404,
 * no matter which page you are on.
 */

const HIDE_PREFIXES = ['/admin', '/api', '/platform', '/seat-booking', '/_next'];
const LOCALE_PREFIXES = ['/zh-tw', '/zh-cn', '/en', '/ja', '/ko', '/zh'];

function stripLocalePrefix(pathname: string): string {
  const prefix = LOCALE_PREFIXES.filter((p) => p)
    .sort((a, b) => b.length - a.length)
    .find((p) => pathname === p || pathname.startsWith(p + '/'));
  if (!prefix) return pathname;
  return '/' + pathname.slice(prefix.length).replace(/^\//, '');
}

/** Map any known route to the 5 core GEO sections; null = non-core page. */
function resolveSection(pathname: string): GeoSection | null {
  const rest = stripLocalePrefix(pathname).replace(/^\//, '').toLowerCase();
  if (rest === '') return 'home';
  if (rest === 'about') return 'about';
  if (rest === 'airport-transfer' || rest === 'services/airport-transfer') return 'airport';
  if (rest === 'charter-bus' || rest === 'services/coach-charter') return 'charter';
  if (
    rest === 'blog/taipei-jiufen-charter' ||
    rest === 'blog/taipei-to-jiufen-charter-bus-price' ||
    rest === 'blog/taipei-jiufen-charter-rates' ||
    rest === 'travel/taipei-jiufen'
  ) {
    return 'jiufen';
  }
  return null;
}

function urlToPath(url: string): string {
  const p = url.replace(GEO_BASE, '');
  return p === '' ? '/' : p;
}

function currentLocale(prefix: string): GeoLocale {
  if (prefix === '/en') return 'en';
  if (prefix === '/ja') return 'ja';
  if (prefix === '/zh-cn') return 'zh-Hans';
  if (prefix === '/ko') return 'ko';
  return 'zh-Hant';
}

export default function LanguageSwitcher() {
  const pathname = usePathname() ?? '/';

  if (HIDE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return null;
  }

  const section = resolveSection(pathname);
  const activeLocale = currentLocale(
    LOCALE_PREFIXES.filter((p) => p)
      .sort((a, b) => b.length - a.length)
      .find((p) => pathname === p || pathname.startsWith(p + '/')) ?? ''
  );

  return (
    <nav aria-label="語言選擇 Language" style={{ position: 'absolute', top: 6, left: 6, zIndex: 9999 }}>
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: 2,
          background: 'rgba(20,20,20,0.55)',
          borderRadius: 999,
          backdropFilter: 'blur(3px)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", sans-serif',
        }}
      >
        {GEO_LOCALES.map((code) => {
          const isActive = code === activeLocale;
          // Target: same section in this locale if translated, else locale home.
          let href = '/';
          if (section) {
            const url = GEO_SECTION_MAP[section][code];
            if (url) href = urlToPath(url);
            else if (code !== 'zh-Hant') href = LOCALE_PREFIXES.find((p) => currentLocale(p) === code) || '/';
          } else if (code !== 'zh-Hant') {
            href = LOCALE_PREFIXES.find((p) => p && currentLocale(p) === code) || '/';
          }
          const label =
            code === 'zh-Hant' ? '繁' : code === 'en' ? 'EN' : code === 'ja' ? '日' : code === 'zh-Hans' ? '简' : '한';
          return (
            <Link
              key={code}
              href={href}
              aria-current={isActive ? 'true' : undefined}
              style={{
                display: 'inline-block',
                padding: '0 8px',
                lineHeight: '22px',
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                borderRadius: 999,
                color: isActive ? '#fff' : 'rgba(255,255,255,0.85)',
                background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                textDecoration: 'none',
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
