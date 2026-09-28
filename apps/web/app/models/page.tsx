"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import type { ModelDefinition } from "@aevrix/shared-types";
import { api } from "@/lib/api";
export default function Models(){const{data=[]}=useQuery<ModelDefinition[]>({queryKey:["models"],queryFn:()=>api("/models")});return <><div className="page-header"><div><div className="eyebrow">Model registry</div><h1>Video models</h1><p>Capabilities are defined centrally, keeping the creator workflow provider-independent.</p></div></div><div className="model-grid">{data.map(model=><article className="panel model-card" key={model.id}><div className="model-icon"><Sparkles size={20}/></div><h2>{model.displayName}</h2><p className="section-copy">{model.description}</p><div className="meta">Provider: {model.provider}</div><div className="chips">{Object.entries(model.capabilities).filter(([,v])=>v).map(([key])=><span className="chip" key={key}>{key.replace(/([A-Z])/g," $1")}</span>)}</div><div className="cost-line"><span>Resolution</span><strong>{model.resolutions.join(" · ")}</strong></div><div className="cost-line"><span>Duration</span><strong>{model.durations.map(duration=>`${duration}s`).join(" · ")}</strong></div><Link href="/" className="button primary" style={{width:"100%",marginTop:15}}>Use model</Link></article>)}</div></>}
