import "./globals.css";

export const metadata = {
  title: "kamalesh varma Portfolio",
  description: "I craft scalable digital products from concept to deployment — combining precise engineering with thoughtful design to build things that actually matter.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
