import type { Metadata } from "next";
import { Host_Grotesk, Teko } from "next/font/google";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// FontAwesome CSS is imported above; stop it injecting styles at runtime (avoids icon flash on SSR)
config.autoAddCss = false;

// The public site's two faces: Teko for display, Host Grotesk for everything else.
const teko = Teko({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-teko",
  display: "swap",
});

const hostGrotesk = Host_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-host-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Beyond Service Admin", template: "%s · Beyond Service Admin" },
  description: "Admin dashboard for Beyond Service: Trial of the Gods",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${teko.variable} ${hostGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
