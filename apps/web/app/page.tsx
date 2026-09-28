"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight, Box, Camera, Check, Clapperboard, ImagePlus, Layers3,
  Lightbulb, Move3d, Music2, Play, Settings2, Sparkles, Video,
  WandSparkles, X, Zap,
} from "lucide-react";
import type {
  Asset, CostEstimate, CreateGenerationRequest, Generation, Health,
  ModelDefinition, Preset, Settings,
} from "@aevrix/shared-types";
import { api, ApiClientError, uploadAsset } from "@/lib/api";

const schema = z.object({
  modelId: z.string(),
  prompt: z.string().trim().min(1, "Describe the video you want to create.").max(4000),
  duration: z.number(), resolution: z.string(), aspectRatio: z.string(), generateAudio: z.boolean(),
  seed: z.string().refine((value) => value === "" || (Number.isInteger(Number(value)) && Number(value) >= 0), "Use a positive whole number."),
  imageAssetId: z.string().optional(), lastFrameAssetId: z.string().optional(),
  referenceImageAssetIds: z.array(z.string()), referenceVideoAssetIds: z.array(z.string()), referenceAudioAssetIds: z.array(z.string()),
});
type FormValues = z.infer<typeof schema>;
type DirectionKey = "camera" | "lighting" | "motion" | "style" | "environment" | "audio";
type CreationMode = "text" | "image" | "product" | "3d";

const defaults: FormValues = {
  modelId: "seedance-2.0", prompt: "", duration: 5, resolution: "720p", aspectRatio: "16:9",
  generateAudio: true, seed: "", imageAssetId: "", lastFrameAssetId: "",
  referenceImageAssetIds: [], referenceVideoAssetIds: [], referenceAudioAssetIds: [],
};
const modeOptions: Array<{ id: CreationMode; label: string; description: string; icon: typeof Clapperboard; direction?: Partial<Record<DirectionKey, string>> }> = [
  { id: "text", label: "Text to video", description: "Describe any scene", icon: Clapperboard },
  { id: "image", label: "Animate image", description: "Bring a still to life", icon: ImagePlus, direction: { motion: "natural image animation with dimensional parallax" } },
  { id: "product", label: "Product motion", description: "Create a polished ad", icon: Box, direction: { camera: "controlled product camera orbit", style: "premium commercial", lighting: "studio product lighting" } },
  { id: "3d", label: "3D animation", description: "Build dimensional worlds", icon: Move3d, direction: { style: "high-end 3D animation", motion: "smooth physically believable animation", lighting: "cinematic global illumination" } },
];
const promptIdeas = [
  "A futuristic sneaker rotates above a reflective platform, dramatic rim light, premium product film",
  "A tiny glass city grows from a desk at sunrise, macro lens, magical realism, slow camera push-in",
  "A fashion model walks through an impossible chrome gallery, fluid fabric motion, editorial lighting",
  "A cozy coffee shop transforms into a lush forest, seamless transition, cinematic atmosphere",
];
const directionGroups: Array<{ key: DirectionKey; label: string; icon: typeof Camera; options: string[] }> = [
  { key: "style", label: "Visual style", icon: Layers3, options: ["Photoreal", "Cinematic", "3D render", "Anime", "Claymation", "Luxury commercial"] },
  { key: "camera", label: "Camera", icon: Camera, options: ["Slow push-in", "Orbit shot", "Tracking shot", "Handheld", "Drone reveal", "Locked camera"] },
  { key: "motion", label: "Motion", icon: Zap, options: ["Natural motion", "Slow motion", "Dynamic action", "Seamless loop", "Floating motion", "Time-lapse"] },
];

export default function CreatePage() {
  const client = useQueryClient();
  const [activeId, setActiveId] = useState<string>();
  const [mode, setMode] = useState<CreationMode>("text");
  const [advanced, setAdvanced] = useState<Record<DirectionKey, string>>({ camera: "", lighting: "", motion: "", style: "", environment: "", audio: "" });
  const [message, setMessage] = useState<string>();
  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const values = watch();
  const { data: models = [] } = useQuery<ModelDefinition[]>({ queryKey: ["models"], queryFn: () => api("/models") });
  const { data: assets = [] } = useQuery<Asset[]>({ queryKey: ["assets"], queryFn: () => api("/assets") });
  const { data: presets = [] } = useQuery<Preset[]>({ queryKey: ["presets"], queryFn: () => api("/presets") });
  const { data: settings, isError: settingsUnavailable } = useQuery<Settings>({ queryKey: ["settings"], queryFn: () => api("/settings") });
  const { data: health } = useQuery<Health>({ queryKey: ["health"], queryFn: () => api("/health") });
  const model = models.find((item) => item.id === values.modelId);
  const generationReady = settings ? settings.mockMode || settings.replicateConfigured : !settingsUnavailable;
  const imageReady = mode !== "image" || Boolean(values.imageAssetId);

  useEffect(() => {
    if (!model) return;
    if (!model.durations.includes(values.duration)) setValue("duration", model.durations[0]);
    if (!model.resolutions.includes(values.resolution)) setValue("resolution", model.resolutions[0]);
    if (!model.aspectRatios.includes(values.aspectRatio)) setValue("aspectRatio", model.aspectRatios[0]);
    if (!model.capabilities.nativeAudio && values.generateAudio) setValue("generateAudio", false);
    if (!model.capabilities.firstLastFrame && values.lastFrameAssetId) setValue("lastFrameAssetId", "");
    if (!model.capabilities.referenceImages && values.referenceImageAssetIds.length) setValue("referenceImageAssetIds", []);
    if (!model.capabilities.referenceVideos && values.referenceVideoAssetIds.length) setValue("referenceVideoAssetIds", []);
    if (!model.capabilities.referenceAudio && values.referenceAudioAssetIds.length) setValue("referenceAudioAssetIds", []);
  }, [model, setValue, values.aspectRatio, values.duration, values.generateAudio, values.lastFrameAssetId, values.referenceAudioAssetIds, values.referenceImageAssetIds, values.referenceVideoAssetIds, values.resolution]);

  const { data: cost } = useQuery<CostEstimate>({
    queryKey: ["cost", values.modelId, values.resolution, values.duration],
    queryFn: () => api("/cost-estimate", { method: "POST", body: JSON.stringify({ modelId: values.modelId, resolution: values.resolution, duration: values.duration }) }),
  });
  const { data: active } = useQuery<Generation>({
    queryKey: ["generation", activeId], queryFn: () => api(`/generations/${activeId}`), enabled: Boolean(activeId),
    refetchInterval: (query) => ["SUCCEEDED", "FAILED", "CANCELED"].includes((query.state.data as Generation | undefined)?.status || "") ? false : 800,
  });
  useEffect(() => {
    const stored = localStorage.getItem("aevrix-duplicate"); if (!stored) return;
    try { reset({ ...defaults, ...JSON.parse(stored) }); setMessage("Generation settings loaded. Review and adjust anything before generating."); }
    finally { localStorage.removeItem("aevrix-duplicate"); }
  }, [reset]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); (document.getElementById("generation-form") as HTMLFormElement | null)?.requestSubmit(); } };
    addEventListener("keydown", handler); return () => removeEventListener("keydown", handler);
  }, []);

  const create = useMutation<Generation, ApiClientError, CreateGenerationRequest>({
    mutationFn: (body) => api("/generations", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (generation) => { setActiveId(generation.id); setMessage(undefined); client.invalidateQueries({ queryKey: ["stats"] }); },
    onError: (error) => setMessage(error.message),
  });
  const enhance = useMutation<{ prompt: string }, ApiClientError>({
    mutationFn: () => api("/prompts/enhance", { method: "POST", body: JSON.stringify({ prompt: values.prompt, ...advanced }) }),
    onSuccess: ({ prompt }) => { setValue("prompt", prompt, { shouldValidate: true }); setAdvanced({ camera: "", lighting: "", motion: "", style: "", environment: "", audio: "" }); setMessage("Enhanced prompt applied. You can still edit every word."); },
    onError: (error) => setMessage(error.message),
  });
  const onSubmit = (data: FormValues) => {
    if (!generationReady) { setMessage(settingsUnavailable ? "Start the local API before generating." : "Connect your Replicate API key before generating."); return; }
    if (!imageReady) { setMessage("Add an opening image before using Animate image mode."); return; }
    const direction = Object.entries(advanced).filter(([, value]) => value.trim()).map(([key, value]) => `${key}: ${value}`).join("; ");
    create.mutate({ ...data, enhancedPrompt: direction ? `${data.prompt}\n\nCreative direction — ${direction}.` : undefined, seed: data.seed === "" ? undefined : Number(data.seed), imageAssetId: data.imageAssetId || undefined, lastFrameAssetId: data.lastFrameAssetId || undefined, idempotencyKey: crypto.randomUUID() });
  };
  const selectMode = (option: typeof modeOptions[number]) => { setMode(option.id); if (option.direction) setAdvanced((current) => ({ ...current, ...option.direction })); };
  const setDirection = (key: DirectionKey, value: string) => setAdvanced((current) => ({ ...current, [key]: current[key] === value ? "" : value }));
  const upload = async (file: File, type: "IMAGE" | "VIDEO" | "AUDIO") => {
    try {
      const item = await uploadAsset(file) as Asset; await client.invalidateQueries({ queryKey: ["assets"] });
      if (type === "IMAGE" && (mode === "image" || !model?.capabilities.referenceImages)) setValue("imageAssetId", item.id);
      else if (type === "IMAGE") setValue("referenceImageAssetIds", [...values.referenceImageAssetIds, item.id]);
      if (type === "VIDEO") setValue("referenceVideoAssetIds", [...values.referenceVideoAssetIds, item.id]);
      if (type === "AUDIO") setValue("referenceAudioAssetIds", [...values.referenceAudioAssetIds, item.id]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed"); }
  };
  const applyPreset = (preset: Preset) => {
    setValue("modelId", preset.modelId); setValue("aspectRatio", preset.aspectRatio); setValue("duration", preset.duration); setValue("resolution", preset.resolution); setValue("generateAudio", preset.generateAudio);
    setAdvanced((current) => ({ ...current, style: preset.promptModifier }));
  };
  const optionsFor = (type: Asset["type"]) => assets.filter((asset) => asset.type === type);
  const statusDone = active && ["SUCCEEDED", "FAILED", "CANCELED"].includes(active.status);
  const refs = useMemo(() => [
    ...values.referenceImageAssetIds.map((id, index) => ({ id, label: `Image${index + 1}` })),
    ...values.referenceVideoAssetIds.map((id, index) => ({ id, label: `Video${index + 1}` })),
    ...values.referenceAudioAssetIds.map((id, index) => ({ id, label: `Audio${index + 1}` })),
  ], [values.referenceImageAssetIds, values.referenceVideoAssetIds, values.referenceAudioAssetIds]);
  const selectedDirections = Object.entries(advanced).filter(([, value]) => value.trim());

  return <div className="creator-page">
    <header className="creator-hero">
      <div><div className="eyebrow">AI video workspace</div><h1>Create something impossible.</h1><p>Start simple, then shape the motion, look, and sound with creator-friendly controls.</p></div>
      <div className={`provider-pill ${generationReady ? "ready" : "needs-setup"}`}><span className="signal"/><div><strong>{settingsUnavailable ? "Local API offline" : settings?.mockMode ? "Studio demo ready" : settings?.replicateConfigured ? "Replicate connected" : "Connect Replicate"}</strong><small>{settingsUnavailable ? "Start the backend to continue" : settings?.mockMode ? "No credits will be used" : generationReady ? "Ready to generate" : "API key required"}</small></div>{!generationReady && !settingsUnavailable && <Link href="/settings">Set up <ArrowRight size={13}/></Link>}</div>
    </header>

    <div className="workflow-steps" aria-label="Generation workflow"><span className="active"><b>1</b> Idea</span><i/><span><b>2</b> References</span><i/><span><b>3</b> Look & motion</span><i/><span><b>4</b> Generate</span></div>

    <section className="mode-picker" aria-label="Creation mode">
      {modeOptions.map((option) => { const Icon = option.icon; return <button type="button" key={option.id} className={`mode-card ${mode === option.id ? "selected" : ""}`} onClick={() => selectMode(option)}><span className="mode-icon"><Icon size={19}/></span><span><strong>{option.label}</strong><small>{option.description}</small></span>{mode === option.id && <Check className="mode-check" size={14}/>}</button>; })}
    </section>

    {active && <section className={`generation-result panel ${active.status.toLowerCase()}`} aria-live="polite">
      <div className="result-preview">{active.outputUrl ? <video src={active.outputUrl} controls poster={active.thumbnailUrl || undefined}/> : <div className="result-wait"><span className={statusDone ? "result-state" : "spinner"}>{statusDone && (active.status === "FAILED" ? "!" : "✓")}</span><small>{active.progress}%</small></div>}</div>
      <div className="result-copy"><div className="eyebrow">Latest generation</div><h2>{active.status === "SUCCEEDED" ? "Your video is ready" : active.status === "FAILED" ? "Generation needs attention" : active.status === "CANCELED" ? "Generation canceled" : "Creating your video"}</h2><p>{active.errorMessage || (statusDone ? "Preview, download, or continue refining from the generation details." : "You can keep exploring the workspace while AEVRIX renders in the background.")}</p><div className="progress-bar"><span style={{ width: `${active.progress}%` }}/></div>{active.status === "SUCCEEDED" && <Link className="button small" href={`/generations/${active.id}`}>Open generation <ArrowRight size={14}/></Link>}</div>
    </section>}

    <form id="generation-form" onSubmit={handleSubmit(onSubmit)} className="creator-layout">
      <div className="creator-main stack">
        <section className="panel composer-panel">
          <div className="panel-header"><div className="step-heading"><span>1</span><div><h2>Describe your idea</h2><p className="section-copy">Write naturally. A subject, action, place, and camera move is enough.</p></div></div><button className="button small ghost" type="button" disabled={!values.prompt || enhance.isPending} onClick={() => enhance.mutate()}><WandSparkles size={14}/>{enhance.isPending ? "Enhancing…" : "Enhance"}</button></div>
          <div className="panel-body stack">
            <label className="prompt-composer"><textarea {...register("prompt")} placeholder={mode === "product" ? "A premium perfume bottle rises through soft mist as the camera slowly orbits…" : mode === "3d" ? "A tiny astronaut explores a colorful 3D planet with floating islands…" : mode === "image" ? "Describe how your image should move and how the camera should behave…" : "A cinematic scene of…"}/><span className="prompt-count">{values.prompt.length} / 4000</span><button type="button" className="prompt-magic" disabled={!values.prompt} onClick={() => enhance.mutate()} aria-label="Enhance prompt"><Sparkles size={15}/></button></label>
            {errors.prompt && <div className="alert">{errors.prompt.message}</div>}
            <div className="idea-row"><span><Lightbulb size={13}/>Try an idea</span><div>{promptIdeas.slice(0, 3).map((idea, index) => <button type="button" key={idea} onClick={() => setValue("prompt", idea, { shouldValidate: true })}>{index + 1}</button>)}</div><small>{promptIdeas.find((idea) => idea === values.prompt) || "Pick a starter, then make it yours."}</small></div>
            {refs.length > 0 && <div className="prompt-references"><span>Insert a reference</span>{refs.map((ref) => <button type="button" key={ref.label} onClick={() => setValue("prompt", `${values.prompt}${values.prompt ? " " : ""}[${ref.label}]`)}>[{ref.label}]</button>)}</div>}
          </div>
        </section>

        <section className="panel reference-panel">
          <div className="panel-header"><div className="step-heading"><span>2</span><div><h2>Add visual references <em>Optional</em></h2><p className="section-copy">Guide the character, opening frame, movement, or soundtrack.</p></div></div><Link href="/assets" className="button small ghost">Browse library</Link></div>
          <div className="panel-body stack">
            <div className="reference-grid enhanced"><UploadCard type="IMAGE" icon={<ImagePlus/>} label={mode === "image" ? "Upload image to animate" : "Add an image"} accept="image/jpeg,image/png,image/webp" upload={upload}/>{model?.capabilities.referenceVideos && <UploadCard type="VIDEO" icon={<Video/>} label="Add motion reference" accept="video/mp4,video/webm,video/quicktime" upload={upload}/>} {model?.capabilities.referenceAudio && <UploadCard type="AUDIO" icon={<Music2/>} label="Add audio reference" accept="audio/mpeg,audio/wav,audio/mp4,audio/aac" upload={upload}/>}</div>
            {values.imageAssetId && <SelectedAsset asset={assets.find((item) => item.id === values.imageAssetId)} label="Opening image" onRemove={() => setValue("imageAssetId", "")}/>} 
            {model?.capabilities.imageToVideo && <div className="two-col"><AssetSelect label="Opening image" assets={optionsFor("IMAGE")} value={values.imageAssetId || ""} onChange={(value) => setValue("imageAssetId", value)}/>{model.capabilities.firstLastFrame && <AssetSelect label="End frame" assets={optionsFor("IMAGE")} value={values.lastFrameAssetId || ""} onChange={(value) => setValue("lastFrameAssetId", value)}/>}</div>}
            {(model?.capabilities.referenceImages || model?.capabilities.referenceVideos || model?.capabilities.referenceAudio) && <details className="advanced"><summary>More reference controls</summary><div className="three-col advanced-fields">{model.capabilities.referenceImages && <MultiAssetSelect label="Images" assets={optionsFor("IMAGE")} values={values.referenceImageAssetIds} max={9} onChange={(value) => setValue("referenceImageAssetIds", value)}/>} {model.capabilities.referenceVideos && <MultiAssetSelect label="Videos" assets={optionsFor("VIDEO")} values={values.referenceVideoAssetIds} max={3} onChange={(value) => setValue("referenceVideoAssetIds", value)}/>} {model.capabilities.referenceAudio && <MultiAssetSelect label="Audio" assets={optionsFor("AUDIO")} values={values.referenceAudioAssetIds} max={3} onChange={(value) => setValue("referenceAudioAssetIds", value)}/>}</div></details>}
          </div>
        </section>

        <section className="panel direction-panel">
          <div className="panel-header"><div className="step-heading"><span>3</span><div><h2>Choose the look and motion</h2><p className="section-copy">Tap a creative direction. Everything remains visible and editable.</p></div></div></div>
          <div className="panel-body direction-stack">
            {directionGroups.map((group) => { const Icon = group.icon; return <div className="direction-row" key={group.key}><span><Icon size={15}/>{group.label}</span><div>{group.options.map((option) => <button type="button" key={option} className={advanced[group.key] === option ? "selected" : ""} onClick={() => setDirection(group.key, option)}>{option}</button>)}</div></div>; })}
            <details className="advanced"><summary><Settings2 size={14}/>Fine-tune direction</summary><div className="advanced-fields">{(["lighting", "environment", "audio"] as DirectionKey[]).map((key) => <label className="field" key={key}><span>{key[0].toUpperCase() + key.slice(1)}</span><input value={advanced[key]} onChange={(event) => setAdvanced((current) => ({ ...current, [key]: event.target.value }))} placeholder={`Describe ${key}`}/></label>)}</div></details>
            {selectedDirections.length > 0 && <div className="direction-recipe"><span>Creative recipe</span>{selectedDirections.map(([key, value]) => <button type="button" key={key} onClick={() => setDirection(key as DirectionKey, value)}>{value}<X size={11}/></button>)}</div>}
          </div>
        </section>

        <section className="preset-strip"><div><div className="eyebrow">Quick recipes</div><h2>Start with a proven creative direction</h2></div><div className="preset-scroll">{presets.map((preset, index) => <button type="button" key={preset.id} onClick={() => applyPreset(preset)}><span>0{index + 1}</span><strong>{preset.name}</strong><small>{preset.description}</small></button>)}</div></section>
      </div>

      <aside className="creator-sidebar">
        <section className="panel settings-card">
          <div className="panel-header"><div><div className="eyebrow">Output</div><h2>Generation setup</h2></div><Settings2 size={17}/></div>
          <div className="panel-body stack">
            <label className="field model-select"><span>AI model</span><select {...register("modelId")}>{models.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select>{model && <small>{model.description}</small>}</label>
            {model && <div className="capability-list">{model.capabilities.imageToVideo && <span><Check size={11}/>Image motion</span>}{model.capabilities.nativeAudio && <span><Check size={11}/>Native audio</span>}{model.capabilities.referenceVideos && <span><Check size={11}/>References</span>}</div>}
            <Choice label="Length" values={model?.durations || [5, 7, 10, 15, 20, 30]} current={values.duration} format={(value) => `${value}s`} onChange={(value) => setValue("duration", value)}/>
            <Choice label="Quality" values={model?.resolutions || ["720p"]} current={values.resolution} onChange={(value) => setValue("resolution", value)}/>
            <RatioChoice values={model?.aspectRatios || ["16:9"]} current={values.aspectRatio} onChange={(value) => setValue("aspectRatio", value)}/>
            {model?.capabilities.nativeAudio && <div className="toggle-row audio-toggle"><div><h3><Music2 size={14}/>Generate audio</h3><p className="section-copy">Dialogue, ambience, and sound.</p></div><button type="button" className={`toggle ${values.generateAudio ? "on" : ""}`} onClick={() => setValue("generateAudio", !values.generateAudio)} aria-pressed={values.generateAudio}><span/></button></div>}
            <details className="advanced seed-control"><summary>Advanced output</summary><label className="field"><span>Seed <small className="field-help">Optional</small></span><input type="number" min="0" placeholder="Automatic" {...register("seed")}/></label></details>
          </div>
        </section>

        <section className="generation-summary">
          <div className="summary-top"><span>Generation summary</span><small>{cost?.label || "Estimated"}</small></div>
          <div className="summary-output"><RatioGlyph ratio={values.aspectRatio}/><div><strong>{model?.displayName || "Choose model"}</strong><span>{values.duration}s · {values.resolution} · {aspectLabel(values.aspectRatio)}</span></div></div>
          <div className="summary-cost"><span>Estimated provider cost</span><strong>{cost?.providerCost == null ? "Dynamic" : `$${cost.providerCost.toFixed(2)}`}</strong></div>
          <div className="summary-cost"><span>Local credits</span><strong>{cost?.credits ?? "—"}</strong></div>
          {!generationReady && <div className="alert notice">{settingsUnavailable ? "Start the local API before generating." : "Connect your Replicate API key in Settings before generating."}</div>}
          {!imageReady && <div className="alert notice">Add an opening image to use Animate image mode.</div>}
          {health?.status === "degraded" && <div className="alert notice">A local service needs attention. Check Settings.</div>}
          {message && <div className={`alert ${message.includes("loaded") || message.includes("applied") ? "success" : ""}`}>{message}</div>}
          <button className="button primary generate-button" type="submit" disabled={!generationReady || !imageReady || isSubmitting || create.isPending}>{create.isPending ? <><span className="spinner"/>Queuing…</> : <><Play size={16} fill="currentColor"/>Generate video <kbd>Ctrl ↵</kbd></>}</button>
          <p className="generate-note">Your prompt and references are sent only to your configured generation provider.</p>
        </section>
      </aside>
    </form>
  </div>;
}

function Choice<T extends string | number>({ label, values, current, onChange, format = String }: { label: string; values: T[]; current: T; onChange: (value: T) => void; format?: (value: T) => string }) {
  return <div className="field choice-field"><span>{label}</span><div className="segmented">{values.map((value) => <button type="button" key={value} className={`segment ${current === value ? "selected" : ""}`} onClick={() => onChange(value)}>{format(value)}</button>)}</div></div>;
}
function RatioChoice({ values, current, onChange }: { values: string[]; current: string; onChange: (value: string) => void }) {
  const featured = ["16:9", "9:16", "1:1", "4:5"].filter((ratio) => values.includes(ratio));
  return <div className="field ratio-field"><span>Format <small className="field-help">Platform-ready</small></span><div className="ratio-options">{featured.map((ratio) => <button type="button" key={ratio} className={current === ratio ? "selected" : ""} onClick={() => onChange(ratio)}><RatioGlyph ratio={ratio}/><span>{ratio}</span><small>{ratioUse(ratio)}</small></button>)}</div><select aria-label="More aspect ratios" value={featured.includes(current) ? "" : current} onChange={(event) => event.target.value && onChange(event.target.value)}><option value="">More formats…</option>{values.filter((ratio) => !featured.includes(ratio)).map((ratio) => <option key={ratio} value={ratio}>{aspectLabel(ratio)}</option>)}</select></div>;
}
function RatioGlyph({ ratio }: { ratio: string }) { const [width = 16, height = 9] = ratio === "adaptive" ? [1, 1] : ratio.split(":").map(Number); const scale = Math.min(28 / width, 22 / height); return <i className="ratio-glyph" style={{ width: Math.max(6, width * scale), height: Math.max(6, height * scale) }}/>; }
function UploadCard({ type, icon, label, accept, upload }: { type: "IMAGE" | "VIDEO" | "AUDIO"; icon: React.ReactNode; label: string; accept: string; upload: (file: File, type: "IMAGE" | "VIDEO" | "AUDIO") => void }) { return <label className="upload-card"><span className="upload-icon">{icon}</span><strong>{label}</strong><small>Drop here or browse · 100 MB max</small><input type="file" accept={accept} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, type); event.target.value = ""; }}/></label>; }
function SelectedAsset({ asset, label, onRemove }: { asset?: Asset; label: string; onRemove: () => void }) { if (!asset) return null; return <div className="selected-asset"><div>{asset.type === "IMAGE" ? <img src={asset.url} alt=""/> : <Clapperboard size={18}/>}</div><span><strong>{label}</strong><small>{asset.originalName}</small></span><button type="button" className="icon-button" onClick={onRemove} aria-label={`Remove ${label}`}><X size={13}/></button></div>; }
function AssetSelect({ label, assets, value, onChange }: { label: string; assets: Asset[]; value: string; onChange: (value: string) => void }) { return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Not selected</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.originalName}</option>)}</select></label>; }
function MultiAssetSelect({ label, assets, values, max, onChange }: { label: string; assets: Asset[]; values: string[]; max: number; onChange: (value: string[]) => void }) { return <div className="field"><span>{label}<small className="field-help">{values.length}/{max}</small></span><select value="" onChange={(event) => { if (event.target.value && !values.includes(event.target.value) && values.length < max) onChange([...values, event.target.value]); }}><option value="">Add asset…</option>{assets.filter((asset) => !values.includes(asset.id)).map((asset) => <option key={asset.id} value={asset.id}>{asset.originalName}</option>)}</select><div className="chips">{values.map((id, index) => <span className="chip" key={id}>{label.replace(/s$/, "")} {index + 1}<button type="button" onClick={() => onChange(values.filter((value) => value !== id))}><X size={10}/></button></span>)}</div></div>; }
function aspectLabel(value: string) { const labels: Record<string, string> = { "16:9": "16:9 Landscape", "9:16": "9:16 Vertical", "1:1": "1:1 Square", "4:5": "4:5 Portrait", "5:4": "5:4 Landscape", "3:4": "3:4 Portrait", "4:3": "4:3 Classic", "2:3": "2:3 Portrait", "3:2": "3:2 Photo", "1.91:1": "1.91:1 LinkedIn", "16:10": "16:10 Wide", "21:9": "21:9 Cinema", adaptive: "Adaptive" }; return labels[value] || value; }
function ratioUse(value: string) { return ({ "16:9": "YouTube", "9:16": "Reels", "1:1": "Square", "4:5": "Feed" } as Record<string, string>)[value] || "Custom"; }
