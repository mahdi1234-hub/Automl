import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoML Analytics Agent",
  description:
    "AI-powered data analyst and data scientist chat agent with AutoML capabilities",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#C17F59",
          colorBackground: "#22211E",
          colorText: "#F5F0EB",
          colorInputBackground: "#1A1917",
          colorInputText: "#F5F0EB",
          borderRadius: "0.5rem",
        },
      }}
    >
      <html lang="en">
        <body className="min-h-screen bg-[#0F0F0E] text-[#F5F0EB] antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
