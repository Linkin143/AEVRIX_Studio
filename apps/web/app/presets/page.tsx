"use client";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Aperture } from "lucide-react";
import type { Preset } from "@aevrix/shared-types";
import { api } from "@/lib/api";
export default function Presets(){const router=useRouter();const{data=[]}=useQuery<Preset[]>({queryKey:["presets"],queryFn:()=>api("/presets")});const apply=(p:Preset)=>{localStorage.setItem("aevrix-duplicate",JSON.stringify({modelId:p.modelId,prompt:p.promptModifier,duration:p.duration,resolution:p.resolution,aspectRatio:p.aspectRatio,generateAudio:p.generateAudio}));router.push("/")};return <><div className="page-header"><div><div className="eyebrow">Starting points</div><h1>Creative presets</h1><p>Apply a considered direction, then make it unmistakably yours.</p></div></div><div className="preset-grid">{data.map((p,i)=><article className="panel preset-card" key={p.id}><div className="model-icon"><Aperture size={20}/></div><div className="eyebrow">0{i+1}</div><h2>{p.name}</h2><p className="section-copy">{p.description}</p><div className="chips"><span className="chip">{p.aspectRatio}</span><span className="chip">{p.duration}s</span><span className="chip">{p.resolution}</span></div><button className="button" onClick={()=>apply(p)} style={{width:"100%",marginTop:8}}>Apply preset</button></article>)}</div></>}
