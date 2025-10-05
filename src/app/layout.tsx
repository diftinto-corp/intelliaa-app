import { ThemeProvider } from "@/components/theme-provider";
import { Inter as FontSans } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { cn } from "@/lib/utils";
import { clientEnv } from "@/lib/env";

// Validate environment variables on server-side only
if (typeof window === 'undefined') {
  // Import server env to trigger validation
  import('@/lib/env').then(({ assertEnv }) => {
    try {
      assertEnv();
    } catch (error) {
      // In development, throw to surface issues immediately
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }
      // In production, log error but don't crash (fail gracefully)
      console.error('Environment validation error:', error);
    }
  });
}

const defaultUrl = clientEnv.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Intelliaa",
  description: "Intelliaa - The best AI assistant for your business",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang='en'
      suppressHydrationWarning
      className={cn(
        "min-h-screen bg-background font-sans antialiased",
        fontSans.variable
      )}>
      <body className='bg-background text-foreground' suppressHydrationWarning>
        <ThemeProvider
          attribute='class'
          defaultTheme='light'
          enableSystem
          disableTransitionOnChange>
          <main className='min-h-screen flex flex-col items-center'>
            {children}
          </main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
