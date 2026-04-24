import "./globals.css";

export const metadata = {
  title: "Hierarchy Intelligence — Bajaj Finance Full Stack Challenge",
  description:
    "Submit graph edges, preview validation in real-time, inspect cycle-safe hierarchy trees, and copy the exact API payload. Built for the SRM Full Stack Engineering Challenge.",
  keywords: "hierarchy, graph, tree, cycle detection, API, full stack, Bajaj Finance",
  authors: [{ name: "G Chethan Akash" }],
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0f",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
