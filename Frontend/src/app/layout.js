import "./globals.css";
import ClientProvider from "../../hoc/clientProvider";
import { Questrial } from "next/font/google";
import Script from "next/script";
import './globals.css'

const questrial = Questrial({ weight: "400", subsets: ["latin"] });

export const metadata = {
  title: "Gradus",
  description: "Reformed Learning",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }) {
  const isProduction = process.env.NODE_ENV === "production"; // Node env available at build time

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#22c55e" />

        <link rel="preconnect" href="https://apis.google.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.googleapis.com" crossOrigin="anonymous" />

        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=Questrial:wght@400&display=swap"
          as="style"
        />

        <Script
          id="font-awesome"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
              link.media = 'print';
              link.onload = () => { link.media = 'all'; };
              document.head.appendChild(link);
            `,
          }}
        />

        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-PNSM37ZWXC"
          strategy="lazyOnload"
        />
        <Script id="gtag-init" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-PNSM37ZWXC');
          `}
        </Script>
      </head>

      <body className={`${questrial.className} bg-black relative`}>
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-green-400/30 rounded-full filter blur-3xl opacity-50"></div>
          <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-green-400/30 rounded-full filter blur-3xl opacity-50"></div>
        </div>
        <main>
          <ClientProvider>{children}</ClientProvider>
        </main>

        {/* service worker and PWA removed */}
      </body>
    </html>
  );
}
