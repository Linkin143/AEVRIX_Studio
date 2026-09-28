"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Aperture, Boxes, Clapperboard, Command, Gauge, Menu, Plus, Settings, Sparkles, WandSparkles, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Health, Stats } from "@aevrix/shared-types";
import { api } from "@/lib/api";

const links = [
  { href: "/", label: "Create", icon: Plus }, { href: "/generations", label: "Generations", icon: Clapperboard },
  { href: "/assets", label: "Assets", icon: Boxes }, { href: "/presets", label: "Presets", icon: WandSparkles },
  { href: "/models", label: "Models", icon: Sparkles }, { href: "/dashboard", label: "Dashboard", icon: Gauge },
];
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const [mobile, setMobile] = useState(false); const [palette, setPalette] = useState(false);
  const { data: stats } = useQuery<Stats>({ queryKey: ["stats"], queryFn: () => api("/stats"), refetchInterval: 10000 });
  const { data: health, isError: backendOffline } = useQuery<Health>({ queryKey: ["health"], queryFn: () => api("/health"), refetchInterval: 10000, retry: 1 });
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPalette((value) => !value); } if (event.key === "Escape") { setPalette(false); setMobile(false); } }; addEventListener("keydown", handler); return () => removeEventListener("keydown", handler); }, []);
  const go = (href: string) => { router.push(href); setPalette(false); setMobile(false); };
  return <div className="app-shell">
    <aside className={`sidebar ${mobile ? "open" : ""}`}><div className="brand"><span className="brand-mark"><Aperture size={20}/></span><span>AEVRIX<small>VIDEO STUDIO</small></span><button className="icon-button mobile-only" onClick={() => setMobile(false)} aria-label="Close navigation"><X size={18}/></button></div>
      <nav aria-label="Primary">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href || (href !== "/" && pathname.startsWith(href)) ? "active" : ""} onClick={() => setMobile(false)}><Icon size={18}/><span>{label}</span></Link>)}</nav>
      <div className="sidebar-footer"><button className="command-button" onClick={() => setPalette(true)}><Command size={16}/>Command menu <kbd>⌘K</kbd></button><Link href="/settings" className={pathname === "/settings" ? "active" : ""}><Settings size={18}/>Settings</Link></div>
    </aside>
    <div className="main-column"><header className="topbar"><button className="icon-button mobile-only" onClick={() => setMobile(true)} aria-label="Open navigation"><Menu size={20}/></button><div className="topbar-title">Creative workspace</div><div className="credits"><span className="signal"/> Credits <strong>{Math.floor(stats?.balance ?? 0).toLocaleString()}</strong>{stats?.reserved ? <small>{stats.reserved} reserved</small> : null}</div><Link className="avatar" href="/settings" aria-label="Settings">AK</Link></header>{(backendOffline || health?.status === "degraded") && <div className="system-banner" role="status">{backendOffline ? "The local API is offline. Start it with npm run dev:api." : "A local service needs attention. Open Settings for details."}</div>}<main>{children}</main></div>
    {mobile && <button className="scrim" onClick={() => setMobile(false)} aria-label="Close navigation"/>}
    {palette && <div className="modal-backdrop" onMouseDown={() => setPalette(false)}><div className="command-palette" role="dialog" aria-modal="true" aria-label="Command menu" onMouseDown={(e) => e.stopPropagation()}><div className="command-search"><Command size={18}/>Jump to…</div>{[{label:"Create video",href:"/"},{label:"Open generations",href:"/generations"},{label:"Open assets",href:"/assets"},{label:"Open settings",href:"/settings"}].map((item) => <button key={item.href} onClick={() => go(item.href)}>{item.label}<span>↗</span></button>)}</div></div>}
  </div>;
}
