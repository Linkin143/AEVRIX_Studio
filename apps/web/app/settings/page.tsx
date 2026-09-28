"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Folder, KeyRound, Server } from "lucide-react";
import { useState } from "react";
import type { Health, Settings } from "@aevrix/shared-types";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const client = useQueryClient();
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<string>();
  const { data: settings } = useQuery<Settings>({ queryKey: ["settings"], queryFn: () => api("/settings") });
  const { data: health } = useQuery<Health>({ queryKey: ["health"], queryFn: () => api("/health"), refetchInterval: 10000 });
  const save = useMutation({
    mutationFn: () => api("/settings", { method: "PUT", body: JSON.stringify({ replicateApiToken: token || undefined }) }),
    onSuccess: () => { setToken(""); setMessage("Settings saved on the local backend."); client.invalidateQueries({ queryKey: ["settings"] }); client.invalidateQueries({ queryKey: ["health"] }); },
    onError: (failure: Error) => setMessage(failure.message),
  });
  const test = useMutation({
    mutationFn: () => api<{ connected: boolean }>("/settings/test-connection", { method: "POST" }),
    onSuccess: () => setMessage("Provider connection verified."),
    onError: (failure: Error) => setMessage(failure.message),
  });
  return <>
    <div className="page-header"><div><div className="eyebrow">System</div><h1>Settings</h1><p>Configure inference and inspect the health of your local studio.</p></div></div>
    <div className="settings-grid"><nav className="settings-nav"><a href="#replicate">Replicate</a><a href="#storage">Storage</a><a href="#generation">Generation</a><a href="#health">Health</a></nav><div>
      <section id="replicate" className="panel settings-section"><div className="panel-header"><div><h2>Replicate</h2><p className="section-copy">The token is sent only to your local API and is never returned.</p></div><KeyRound size={18}/></div><div className="panel-body stack">
        <label className="field"><span>API token <small className="field-help">{settings?.mockMode ? "Mock mode is active" : settings?.replicateConfigured ? "Configured" : "Not configured"}</small></span><input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder={settings?.replicateConfigured ? "••••••••••••••••" : "r8_…"}/></label>
        <div className="toolbar"><button className="button primary" disabled={!token || save.isPending} onClick={() => save.mutate()}>Save token</button><button className="button" disabled={!settings?.replicateConfigured || test.isPending} onClick={() => test.mutate()}>{test.isPending ? "Testing…" : "Test connection"}</button></div>
        {message && <div className={message.includes("saved") || message.includes("verified") ? "alert success" : "alert"}>{message}</div>}
      </div></section>
      <section id="storage" className="panel settings-section"><div className="panel-header"><h2>Local storage</h2><Folder size={18}/></div><div className="settings-row"><div><h3>Storage directory</h3><p className="section-copy">Generated media and source assets</p></div><input readOnly value={settings?.storageDirectory || "Loading…"}/></div><div className="settings-row"><div><h3>Database</h3><p className="section-copy">SQLite metadata store</p></div><input readOnly value={settings?.databaseUrl || "Loading…"}/></div></section>
      <section id="generation" className="panel settings-section"><div className="panel-header"><h2>Generation</h2><Server size={18}/></div><div className="settings-row"><span>Max concurrent generations</span><strong>{settings?.maxConcurrentGenerations ?? "—"}</strong></div><div className="settings-row"><span>Polling interval</span><strong>{settings ? `${settings.pollingIntervalMs / 1000}s` : "—"}</strong></div><div className="settings-row"><span>Webhook mode</span><strong>{settings?.webhookMode || "auto"}</strong></div></section>
      <section id="health" className="panel settings-section"><div className="panel-header"><h2>Health</h2><CheckCircle2 size={18} color="var(--accent)"/></div>{[["Database", health?.database], ["Storage", health?.storage], ["Replicate", health?.replicate]].map(([label, value]) => <div className="settings-row" key={label}><span>{label}</span><div className="health-value"><i className="health-dot" style={value === "error" || value === "not_configured" ? { background: "var(--warning)" } : undefined}/><strong>{value || "Checking"}</strong></div></div>)}</section>
    </div></div>
  </>;
}
