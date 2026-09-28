"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
export function Providers({ children }: { children: ReactNode }) { const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 4000, retry: 1 }, mutations: { retry: 0 } } })); return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
