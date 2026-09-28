"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clapperboard, Download, Grid2X2, Heart, List, RotateCcw, Search, Trash2 } from "lucide-react";
import { useDeferredValue, useState } from "react";
import type { CreateGenerationRequest, Generation, ModelDefinition, Paginated } from "@aevrix/shared-types";
import { api, API_URL } from "@/lib/api";

export default function GenerationsPage() {
  const client = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [modelId, setModelId] = useState("");
  const [date, setDate] = useState("");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [error, setError] = useState<string>();
  const deferredSearch = useDeferredValue(search);
  const { data: models = [] } = useQuery<ModelDefinition[]>({ queryKey: ["models"], queryFn: () => api("/models") });
  const { data, isLoading } = useQuery<Paginated<Generation>>({
    queryKey: ["generations", deferredSearch, status, modelId, date, sort],
    queryFn: () => api(`/generations?limit=48&search=${encodeURIComponent(deferredSearch)}&status=${status}&modelId=${modelId}&from=${date}&to=${date}&sort=${sort}`),
    refetchInterval: 3000,
  });
  const action = useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: string }) => {
      if (kind === "delete") return api(`/generations/${id}`, { method: "DELETE" });
      if (kind === "duplicate") {
        const request = await api<CreateGenerationRequest>(`/generations/${id}/duplicate`, { method: "POST" });
        localStorage.setItem("aevrix-duplicate", JSON.stringify(request));
        router.push("/");
        return;
      }
      return api(`/generations/${id}/${kind}`, { method: "POST" });
    },
    onSuccess: () => { client.invalidateQueries({ queryKey: ["generations"] }); client.invalidateQueries({ queryKey: ["stats"] }); },
    onError: (failure: Error) => setError(failure.message),
  });
  const run = (id: string, kind: string) => {
    if (kind === "delete" && !confirm("Delete this generated video from local storage?")) return;
    action.mutate({ id, kind });
  };
  return <>
    <div className="page-header"><div><div className="eyebrow">Library</div><h1>Generations</h1><p>Your local video history, from first frame to final export.</p></div><Link className="button primary" href="/">Create video</Link></div>
    <div className="panel"><div className="panel-body toolbar">
      <div className="search" style={{ position: "relative" }}><Search size={15} style={{ position: "absolute", left: 12, top: 13, color: "var(--muted)" }}/><input aria-label="Search generations" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search prompts…" style={{ paddingLeft: 36 }}/></div>
      <select aria-label="Filter by model" value={modelId} onChange={(event) => setModelId(event.target.value)}><option value="">All models</option>{models.map((model) => <option key={model.id} value={model.id}>{model.displayName}</option>)}</select>
      <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{["QUEUED", "STARTING", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELED"].map((item) => <option key={item}>{item}</option>)}</select>
      <input aria-label="Filter by date" type="date" value={date} onChange={(event) => setDate(event.target.value)} style={{ width: "auto" }}/>
      <select aria-label="Sort generations" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
      <button className="icon-button" onClick={() => setView("grid")} aria-label="Grid view"><Grid2X2 size={16}/></button><button className="icon-button" onClick={() => setView("list")} aria-label="List view"><List size={16}/></button>
    </div></div>
    {error && <div className="alert" style={{ marginTop: 14 }}>{error}</div>}
    <div className={`media-grid ${view}`} style={{ marginTop: 18 }}>
      {isLoading ? [1, 2, 3].map((item) => <div className="skeleton" key={item}/>) : data?.items.length ? data.items.map((generation) =>
        <article className="panel media-card" key={generation.id}>
          <Link href={`/generations/${generation.id}`} className="media-preview">
            {generation.thumbnailUrl ? <img src={generation.thumbnailUrl} alt="" loading="lazy"/> : generation.status === "SUCCEEDED" && generation.outputUrl ? <video src={generation.outputUrl} muted preload="metadata" onMouseEnter={(event) => void event.currentTarget.play()} onMouseLeave={(event) => { event.currentTarget.pause(); event.currentTarget.currentTime = 0; }}/> : <Clapperboard className="placeholder-icon" size={44}/>} 
            <span className="status-badge"><i className={`status-dot ${generation.status}`}/>{generation.status.toLowerCase()}</span>
          </Link>
          <div className="media-info"><div className="media-title">{generation.prompt}</div><div className="meta"><span>{generation.modelId}</span><span>•</span><span>{generation.resolution}</span><span>•</span><span>{generation.duration === -1 ? "Intelligent" : `${generation.duration}s`}</span><span>•</span><span>{new Date(generation.createdAt).toLocaleDateString()}</span></div>
            <div className="card-actions">
              {generation.status === "SUCCEEDED" && <a className="button small" href={`${API_URL}/generations/${generation.id}/download`}><Download size={13}/>Download</a>}
              {generation.status === "FAILED" && <button className="button small" onClick={() => run(generation.id, "retry")}><RotateCcw size={13}/>Retry</button>}
              {["QUEUED", "STARTING", "PROCESSING"].includes(generation.status) && <button className="button small danger" onClick={() => run(generation.id, "cancel")}>Cancel</button>}
              <button className={`icon-button favorite ${generation.favorite ? "on" : ""}`} onClick={() => api(`/generations/${generation.id}/favorite`, { method: "PATCH", body: JSON.stringify({ favorite: !generation.favorite }) }).then(() => client.invalidateQueries({ queryKey: ["generations"] }))} aria-label="Favorite"><Heart size={15} fill={generation.favorite ? "currentColor" : "none"}/></button>
              <button className="icon-button" onClick={() => run(generation.id, "duplicate")} aria-label="Duplicate"><Clapperboard size={15}/></button>
              {!['QUEUED', 'STARTING', 'PROCESSING'].includes(generation.status) && <button className="icon-button" onClick={() => run(generation.id, "delete")} aria-label="Delete"><Trash2 size={15}/></button>}
            </div>
          </div>
        </article>
      ) : <div className="empty"><Clapperboard size={40}/><h2>No generations yet</h2><p>Create your first video and it will appear here.</p><Link className="button primary" href="/">Create video</Link></div>}
    </div>
  </>;
}
