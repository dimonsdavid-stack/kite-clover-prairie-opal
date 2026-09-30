import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { QueryProvider } from "@/lib/query";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "ARCLENØS";
const APP_DESCRIPTION =
  "Autonomous onchain venture infrastructure on Base: observed demand, governed composition, verifiable deployment and revenue-producing services.";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: APP_DESCRIPTION },
      { name: "theme-color", content: "#090A0B" },
      { property: "og:title", content: APP_NAME },
      { property: "og:description", content: APP_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.arclenos.com/" },
      { property: "og:image", content: "https://www.arclenos.com/og.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: APP_NAME },
      { name: "twitter:description", content: APP_DESCRIPTION },
      { name: "twitter:image", content: "https://www.arclenos.com/og.jpg" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "canonical", href: "https://www.arclenos.com/" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthProvider>
          <QueryProvider>
            <Outlet />
            <Toaster
              theme="dark"
              position="bottom-right"
              toastOptions={{
                className: "bg-card text-foreground border-border",
              }}
            />
          </QueryProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
