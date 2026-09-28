import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/shell";
import "./globals.css";

export const metadata: Metadata = { title: "AEVRIX Video Studio", description: "Local-first AI video creation studio" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><Providers><Shell>{children}</Shell></Providers></body></html>; }
