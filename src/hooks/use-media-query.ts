"use client";

import { useEffect, useState } from "react";

/**
 * Custom hook for responsive design with media queries
 *
 * Handles hydration-safe media query matching
 * Returns false during SSR, true/false after mount
 *
 * Usage:
 * const isMobile = useMediaQuery("(max-width: 768px)");
 * const isDesktop = useMediaQuery("(min-width: 1024px)");
 *
 * @param query - CSS media query string
 * @returns Boolean indicating if query matches (false during SSR)
 */
export function useMediaQuery(query: string): boolean {
  // Start with false to avoid hydration mismatch
  const [matches, setMatches] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Create media query list
    const mediaQuery = window.matchMedia(query);

    // Set initial value
    setMatches(mediaQuery.matches);

    // Define listener
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    }
    // Fallback for older browsers
    else {
      // @ts-ignore - deprecated but needed for older browsers
      mediaQuery.addListener(listener);
      // @ts-ignore
      return () => mediaQuery.removeListener(listener);
    }
  }, [query]);

  // Return false during SSR to prevent hydration mismatch
  if (!mounted) {
    return false;
  }

  return matches;
}

/**
 * Predefined breakpoint hooks for common responsive patterns
 */

export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
}

export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}

/**
 * Check if currently mounted (useful for preventing hydration issues)
 */
export function useIsMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
