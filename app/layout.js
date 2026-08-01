import "./globals.css";
import { StoreProvider } from "@/lib/store";

export const metadata = {
  title: "MedGuard — Medication tracker for families",
  description:
    "Caregiver dashboard + patient reminders. Keep aging parents on their meds, on time.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1f66f0",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans text-slate-800">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
