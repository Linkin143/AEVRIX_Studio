"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="panel empty"><AlertTriangle size={40}/><h2>Something interrupted the studio</h2><p>{error.message || "The page could not be loaded."}</p><button className="button primary" onClick={reset}><RotateCcw size={15}/>Try again</button></div>;
}
