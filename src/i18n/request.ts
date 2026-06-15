import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const SUPPORTED_LOCALES = ["en", "am"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * next-intl WITHOUT i18n routing: locale comes from a cookie (set by the locale
 * switcher), defaulting to English. Amharic keys exist from day one even where the
 * translations are still English fallbacks (docs/DESIGN_SYSTEM.md — i18n-ready).
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieValue = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = SUPPORTED_LOCALES.includes(cookieValue as Locale)
    ? (cookieValue as Locale)
    : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
