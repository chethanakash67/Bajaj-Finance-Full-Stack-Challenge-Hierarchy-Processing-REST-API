import "./globals.css";

export const metadata = {
  title: "SRM Full Stack Engineering Challenge",
  description: "Next.js frontend for the SRM hierarchy builder challenge.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
