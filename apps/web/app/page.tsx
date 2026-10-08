"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight, AtSign, Box, Camera, Check, Clapperboard, ImagePlus, Layers3,
  Lightbulb, Move3d, Music2, Play, Settings2, Sparkles, Tag, Video,
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
const CHIP_ATTR = "data-asset-id";
const DRAFT_KEY = "aevrix-draft";

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
  const promptEditorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const draftRestoredRef = useRef(false);
  const pendingPromptRef = useRef<{ prompt: string; tags: string[] } | null>(null);
  const [taggedAssetIds, setTaggedAssetIds] = useState<string[]>([]);
  const [promptLength, setPromptLength] = useState(0);
  const composerRef = useRef<HTMLDivElement>(null);
  const mentionRef = useRef<{ node: Node; start: number; end: number } | null>(null);
  const [mention, setMention] = useState<{ query: string; left: number; top: number } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
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
    const handler = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); (document.getElementById("generation-form") as HTMLFormElement | null)?.requestSubmit(); } };
    addEventListener("keydown", handler); return () => removeEventListener("keydown", handler);
  }, []);

  const saveSelection = useCallback(() => {
    const selection = window.getSelection(); const root = promptEditorRef.current;
    if (selection && selection.rangeCount && root && root.contains(selection.anchorNode)) savedRangeRef.current = selection.getRangeAt(0).cloneRange();
  }, []);
  const restoreSelection = useCallback(() => {
    const root = promptEditorRef.current; const selection = window.getSelection(); if (!root || !selection) return;
    if (savedRangeRef.current && root.contains(savedRangeRef.current.commonAncestorContainer)) { selection.removeAllRanges(); selection.addRange(savedRangeRef.current); }
    else { const range = document.createRange(); range.selectNodeContents(root); range.collapse(false); selection.removeAllRanges(); selection.addRange(range); }
  }, []);
  const serializeEditor = useCallback(() => {
    const root = promptEditorRef.current; if (!root) return { text: "", assetIds: [] as string[] };
    // The same asset may be tagged in several places; de-duplicate (first-seen
    // order) so the reference arrays sent to the provider stay unique.
    const assetIds: string[] = [];
    Array.from(root.querySelectorAll(`[${CHIP_ATTR}]`)).forEach((element) => { const id = element.getAttribute(CHIP_ATTR) as string; if (!assetIds.includes(id)) assetIds.push(id); });
    return { text: root.innerText.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n"), assetIds };
  }, []);
  const renumberChips = useCallback(() => {
    const root = promptEditorRef.current; if (!root) return;
    // Seedance/H3 bind references by typed labels in the prompt: [Image1],
    // [Video1], [Audio1]. Number per-type by first appearance, so every instance
    // of the same asset shares its label no matter how many times it's tagged.
    const labelFor = (element: Element) => element.classList.contains("chip-video") ? "Video" : element.classList.contains("chip-audio") ? "Audio" : "Image";
    const order = new Map<string, string>(); const counts: Record<string, number> = { Image: 0, Video: 0, Audio: 0 };
    Array.from(root.querySelectorAll(`[${CHIP_ATTR}]`)).forEach((element) => {
      const id = element.getAttribute(CHIP_ATTR) as string; const kind = labelFor(element);
      if (!order.has(id)) order.set(id, `${kind}${(counts[kind] += 1)}`);
      const label = element.querySelector(".chip-ref-num"); if (label) label.textContent = `[${order.get(id)}]`;
    });
  }, []);
  const syncFromEditor = useCallback(() => {
    const { text, assetIds } = serializeEditor();
    setValue("prompt", text, { shouldValidate: true }); setPromptLength(text.length); setTaggedAssetIds(assetIds);
  }, [serializeEditor, setValue]);
  const createChipNode = useCallback((asset: Asset) => {
    const chip = document.createElement("span");
    chip.className = `prompt-image-chip chip-${asset.type.toLowerCase()}`; chip.setAttribute(CHIP_ATTR, asset.id); chip.setAttribute("contenteditable", "false");
    if (asset.type === "IMAGE" && asset.url) { const image = document.createElement("img"); image.src = asset.url; image.className = "chip-thumb"; image.alt = ""; image.draggable = false; chip.appendChild(image); }
    else { const glyph = document.createElement("span"); glyph.className = `chip-glyph chip-glyph-${asset.type.toLowerCase()}`; glyph.setAttribute("aria-hidden", "true"); chip.appendChild(glyph); }
    const label = document.createElement("span"); label.className = "chip-ref-num"; label.textContent = "[Image1]"; chip.appendChild(label);
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "chip-remove"; remove.setAttribute("aria-label", `Remove ${asset.originalName}`);
    // Remove only this specific chip instance (not the first match), so removing
    // one duplicate leaves the other occurrences intact.
    remove.addEventListener("mousedown", (event) => { event.preventDefault(); event.stopPropagation(); chip.remove(); renumberChips(); syncFromEditor(); });
    chip.appendChild(remove); return chip;
  }, [renumberChips, syncFromEditor]);
  const insertImageChip = useCallback((asset: Asset) => {
    const root = promptEditorRef.current; if (!root) return;
    root.focus(); restoreSelection();
    const selection = window.getSelection(); const chip = createChipNode(asset); const spacer = document.createTextNode("\u00a0");
    if (selection && selection.rangeCount && root.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0); range.deleteContents(); range.insertNode(spacer); range.insertNode(chip);
      range.setStartAfter(spacer); range.setEndAfter(spacer); selection.removeAllRanges(); selection.addRange(range);
    } else { root.appendChild(chip); root.appendChild(spacer); }
    renumberChips(); syncFromEditor(); saveSelection();
  }, [createChipNode, renumberChips, restoreSelection, saveSelection, syncFromEditor]);
  const renderTextWithChips = useCallback((text: string, assetIds: string[]) => {
    const root = promptEditorRef.current; if (!root) return;
    root.innerHTML = "";
    // assetIds is the de-duplicated tagged list. Rebuild chips from typed labels
    // ([Image1]/[Video1]/[Audio1]) or legacy numeric [1] for older drafts.
    const byType: Record<string, Asset[]> = { IMAGE: [], VIDEO: [], AUDIO: [] };
    assetIds.forEach((id) => { const a = assets.find((item) => item.id === id); if (a) byType[a.type].push(a); });
    text.split(/(\[(?:Image|Video|Audio)\d+\]|\[\d+\])/g).forEach((part) => {
      const typed = /^\[(Image|Video|Audio)(\d+)\]$/.exec(part);
      if (typed) {
        const bucket = typed[1] === "Video" ? "VIDEO" : typed[1] === "Audio" ? "AUDIO" : "IMAGE";
        const asset = byType[bucket][Number(typed[2]) - 1];
        if (asset) { root.appendChild(createChipNode(asset)); return; }
      }
      const legacy = /^\[(\d+)\]$/.exec(part);
      if (legacy) { const asset = assets.find((item) => item.id === assetIds[Number(legacy[1]) - 1]); if (asset) { root.appendChild(createChipNode(asset)); return; } }
      if (part) root.appendChild(document.createTextNode(part));
    });
    renumberChips(); syncFromEditor();
  }, [assets, createChipNode, renumberChips, syncFromEditor]);
  const setPlainPrompt = useCallback((text: string) => renderTextWithChips(text, []), [renderTextWithChips]);

  const closeMention = useCallback(() => { mentionRef.current = null; setMention(null); setMentionIndex(0); }, []);
  const detectMention = useCallback(() => {
    const root = promptEditorRef.current; const composer = composerRef.current;
    const selection = window.getSelection();
    if (!root || !composer || !selection || !selection.rangeCount || !selection.isCollapsed) { closeMention(); return; }
    const focusNode = selection.focusNode;
    if (!focusNode || focusNode.nodeType !== Node.TEXT_NODE || !root.contains(focusNode)) { closeMention(); return; }
    const offset = selection.focusOffset; const before = (focusNode.textContent || "").slice(0, offset);
    const match = /(^|\s)@([^\s@]*)$/.exec(before);
    if (!match) { closeMention(); return; }
    const query = match[2]; const start = offset - query.length - 1;
    mentionRef.current = { node: focusNode, start, end: offset };
    const marker = document.createRange(); marker.setStart(focusNode, start); marker.setEnd(focusNode, Math.min(start + 1, (focusNode.textContent || "").length));
    const rect = marker.getClientRects()[0] || marker.getBoundingClientRect(); const base = composer.getBoundingClientRect();
    setMention({ query, left: rect.left - base.left, top: rect.bottom - base.top + 6 }); setMentionIndex(0);
  }, [closeMention]);
  const confirmMention = useCallback((asset: Asset) => {
    const root = promptEditorRef.current; const target = mentionRef.current; if (!root || !target) { closeMention(); return; }
    root.focus();
    const selection = window.getSelection(); if (!selection) { closeMention(); return; }
    const clampEnd = Math.min(target.end, (target.node.textContent || "").length);
    const range = document.createRange(); range.setStart(target.node, target.start); range.setEnd(target.node, clampEnd); range.deleteContents();
    range.collapse(true); selection.removeAllRanges(); selection.addRange(range); savedRangeRef.current = range.cloneRange();
    closeMention();
    // Same asset can be tagged again at this new spot (shares its [n] number).
    const chip = createChipNode(asset); const spacer = document.createTextNode("\u00a0");
    range.insertNode(spacer); range.insertNode(chip);
    range.setStartAfter(spacer); range.setEndAfter(spacer); selection.removeAllRanges(); selection.addRange(range);
    renumberChips(); syncFromEditor(); saveSelection();
  }, [closeMention, createChipNode, renumberChips, saveSelection, syncFromEditor]);

  // Restore a draft (survives navigating away) or a one-time "duplicate" payload.
  // Duplicate takes priority; both rebuild the rich prompt + tagged chips so the
  // editor never starts blank after leaving and returning to this page.
  useEffect(() => {
    const duplicate = localStorage.getItem("aevrix-duplicate");
    try {
      if (duplicate) {
        const parsed = { ...defaults, ...JSON.parse(duplicate) } as FormValues;
        reset(parsed);
        const tags = [...(parsed.referenceImageAssetIds || []), ...(parsed.referenceVideoAssetIds || []), ...(parsed.referenceAudioAssetIds || [])];
        pendingPromptRef.current = { prompt: parsed.prompt || "", tags };
        setMessage("Generation settings loaded. Review and adjust anything before generating.");
        localStorage.removeItem("aevrix-duplicate");
        return;
      }
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        const { values: saved, mode: savedMode, advanced: savedAdvanced, prompt, taggedAssetIds: tags } = JSON.parse(draft) as { values: FormValues; mode?: CreationMode; advanced?: Record<DirectionKey, string>; prompt?: string; taggedAssetIds?: string[] };
        if (saved) reset({ ...defaults, ...saved });
        if (savedMode) setMode(savedMode);
        if (savedAdvanced) setAdvanced((current) => ({ ...current, ...savedAdvanced }));
        if (prompt) pendingPromptRef.current = { prompt, tags: tags || [] };
      }
    } catch { /* ignore corrupt draft */ }
    finally { draftRestoredRef.current = true; }
  }, [reset]);

  // Rebuild the rich prompt + chips once assets are available (chips resolve by
  // asset id). Runs after restore stashed a pending prompt, and re-runs if assets
  // arrive slightly later than this component mounts.
  useEffect(() => {
    if (!pendingPromptRef.current) return;
    const { prompt, tags } = pendingPromptRef.current;
    if (tags.length && !assets.length) return; // wait for assets so chips resolve
    pendingPromptRef.current = null;
    requestAnimationFrame(() => renderTextWithChips(prompt, tags));
  }, [assets, renderTextWithChips]);

  // Persist the working draft on every meaningful change (after restore), so the
  // prompt, tags and settings stay put when the user leaves and comes back.
  useEffect(() => {
    if (!draftRestoredRef.current || pendingPromptRef.current) return; // don't overwrite before chips rebuild
    const payload = JSON.stringify({ values, mode, advanced, prompt: values.prompt, taggedAssetIds });
    try { localStorage.setItem(DRAFT_KEY, payload); } catch { /* storage full/unavailable */ }
  }, [values, mode, advanced, taggedAssetIds]);

  useEffect(() => {
    const root = promptEditorRef.current;
    if (!model || !root || !root.querySelectorAll(`[${CHIP_ATTR}]`).length) return;
    const allowed: Record<Asset["type"], boolean> = { IMAGE: model.capabilities.referenceImages, VIDEO: model.capabilities.referenceVideos, AUDIO: model.capabilities.referenceAudio };
    let removed = false;
    root.querySelectorAll(`[${CHIP_ATTR}]`).forEach((element) => {
      const asset = assets.find((item) => item.id === element.getAttribute(CHIP_ATTR));
      if (!asset || !allowed[asset.type]) { element.remove(); removed = true; }
    });
    if (removed) { renumberChips(); syncFromEditor(); }
  }, [model, assets, renumberChips, syncFromEditor]);

  const create = useMutation<Generation, ApiClientError, CreateGenerationRequest>({
    mutationFn: (body) => api("/generations", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (generation) => { setActiveId(generation.id); setMessage(undefined); client.invalidateQueries({ queryKey: ["stats"] }); },
    onError: (error) => setMessage(error.message),
  });
  const enhance = useMutation<{ prompt: string }, ApiClientError>({
    mutationFn: () => api("/prompts/enhance", { method: "POST", body: JSON.stringify({ prompt: serializeEditor().text, ...advanced }) }),
    onSuccess: ({ prompt }) => { renderTextWithChips(prompt, serializeEditor().assetIds); setAdvanced({ camera: "", lighting: "", motion: "", style: "", environment: "", audio: "" }); setMessage("Enhanced prompt applied. You can still edit every word."); },
    onError: (error) => setMessage(error.message),
  });
  const generationInFlight = create.isPending || (!!active && ["QUEUED", "STARTING", "PROCESSING"].includes(active.status));
  // Without this, a failed zod validation makes handleSubmit silently skip
  // onSubmit (only errors.prompt is rendered), so "Generate" looked dead.
  const onInvalid = (formErrors: typeof errors) => {
    const first = Object.values(formErrors).find((entry) => entry && "message" in entry) as { message?: string } | undefined;
    setMessage(first?.message || "Please complete the highlighted fields before generating.");
  };
  const onSubmit = (data: FormValues) => {
    if (generationInFlight) { setMessage("A video is already generating. Please wait for it to finish."); return; }
    if (!generationReady) { setMessage(settingsUnavailable ? "Start the local API before generating." : "Connect your Replicate API key before generating."); return; }
    if (!imageReady) { setMessage("Add an opening image before using Animate image mode."); return; }
    const { text: promptText, assetIds: tagged } = serializeEditor();
    const prompt = promptText.trim() || data.prompt;
    // Tagged chips can be images, videos, or audio — route each id to its own
    // reference list by asset type, keeping any ids already set via the dropdowns.
    const taggedByType = (type: Asset["type"]) => tagged.filter((id) => assets.find((item) => item.id === id)?.type === type);
    const merge = (type: Asset["type"], existing: string[]) => { const inPrompt = taggedByType(type); return [...inPrompt, ...existing.filter((id) => !inPrompt.includes(id))]; };
    const referenceImageAssetIds = merge("IMAGE", data.referenceImageAssetIds);
    const referenceVideoAssetIds = merge("VIDEO", data.referenceVideoAssetIds);
    const referenceAudioAssetIds = merge("AUDIO", data.referenceAudioAssetIds);
    const direction = Object.entries(advanced).filter(([, value]) => value.trim()).map(([key, value]) => `${key}: ${value}`).join("; ");
    create.mutate({ ...data, prompt, referenceImageAssetIds, referenceVideoAssetIds, referenceAudioAssetIds, enhancedPrompt: direction ? `${prompt}\n\nCreative direction — ${direction}.` : undefined, seed: data.seed === "" ? undefined : Number(data.seed), imageAssetId: data.imageAssetId || undefined, lastFrameAssetId: data.lastFrameAssetId || undefined, idempotencyKey: crypto.randomUUID() });
  };
  const selectMode = (option: typeof modeOptions[number]) => { setMode(option.id); if (option.direction) setAdvanced((current) => ({ ...current, ...option.direction })); };
  const setDirection = (key: DirectionKey, value: string) => setAdvanced((current) => ({ ...current, [key]: current[key] === value ? "" : value }));
  const upload = async (files: File[], type: "IMAGE" | "VIDEO" | "AUDIO") => {
    try {
      // Upload every selected file, then update state once per type so a batch
      // doesn't overwrite itself through stale closures (setValue with arrays).
      const uploaded: Asset[] = [];
      for (const file of files) uploaded.push(await uploadAsset(file) as Asset);
      await client.invalidateQueries({ queryKey: ["assets"] });
      if (!uploaded.length) return;
      if (type === "IMAGE") {
        const openingFirst = mode === "image" || !model?.capabilities.referenceImages;
        if (openingFirst) { setValue("imageAssetId", uploaded[0].id); uploaded.slice(1).forEach((item) => requestAnimationFrame(() => insertImageChip(item))); }
        else uploaded.forEach((item) => requestAnimationFrame(() => insertImageChip(item)));
      }
      if (type === "VIDEO") setValue("referenceVideoAssetIds", [...values.referenceVideoAssetIds, ...uploaded.map((item) => item.id)]);
      if (type === "AUDIO") setValue("referenceAudioAssetIds", [...values.referenceAudioAssetIds, ...uploaded.map((item) => item.id)]);
      if (uploaded.length > 1) setMessage(`${uploaded.length} files uploaded.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed"); }
  };
  const applyPreset = (preset: Preset) => {
    setValue("modelId", preset.modelId); setValue("aspectRatio", preset.aspectRatio); setValue("duration", preset.duration); setValue("resolution", preset.resolution); setValue("generateAudio", preset.generateAudio);
    setAdvanced((current) => ({ ...current, style: preset.promptModifier }));
  };
  const optionsFor = (type: Asset["type"]) => assets.filter((asset) => asset.type === type);
  const statusDone = active && ["SUCCEEDED", "FAILED", "CANCELED"].includes(active.status);
  const taggableType = useCallback((type: Asset["type"]) => type === "IMAGE" ? Boolean(model?.capabilities.referenceImages) : type === "VIDEO" ? Boolean(model?.capabilities.referenceVideos) : Boolean(model?.capabilities.referenceAudio), [model]);
  // Video & audio assets that this model allows tagging — tapping one inserts a
  // numbered chip in the prompt, exactly like image references.
  const taggableRefs = useMemo(
    () => assets.filter((asset) => (asset.type === "VIDEO" || asset.type === "AUDIO") && taggableType(asset.type)),
    [assets, taggableType],
  );
  const selectedDirections = Object.entries(advanced).filter(([, value]) => value.trim());
  const mentionEnabled = Boolean(model && (model.capabilities.referenceImages || model.capabilities.referenceVideos || model.capabilities.referenceAudio));
  const mentionMatches = useMemo(() => {
    if (!mention) return [] as Asset[];
    const query = mention.query.toLowerCase();
    return assets.filter((asset) => taggableType(asset.type) && (!query || asset.originalName.toLowerCase().includes(query))).slice(0, 6);
  }, [assets, mention, taggableType]);
  useEffect(() => { if (mention && mentionIndex >= mentionMatches.length) setMentionIndex(0); }, [mention, mentionIndex, mentionMatches.length]);
  const onPromptKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!mention || !mentionMatches.length) { if (event.key === "Escape" && mention) { event.preventDefault(); closeMention(); } return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setMentionIndex((current) => (current + 1) % mentionMatches.length); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setMentionIndex((current) => (current - 1 + mentionMatches.length) % mentionMatches.length); }
    else if (event.key === "Enter" || event.key === "Tab") { event.preventDefault(); confirmMention(mentionMatches[mentionIndex] ?? mentionMatches[0]); }
    else if (event.key === "Escape") { event.preventDefault(); closeMention(); }
  }, [closeMention, confirmMention, mention, mentionIndex, mentionMatches]);

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
      <div className="result-copy"><div className="eyebrow">Latest generation</div><h2>{active.status === "SUCCEEDED" ? "Your video is ready" : active.status === "FAILED" ? "Generation needs attention" : active.status === "CANCELED" ? "Generation canceled" : "Creating your video"}</h2><p>{friendlyError(active.errorMessage) || (statusDone ? "Preview, download, or continue refining from the generation details." : "You can keep exploring the workspace while AEVRIX renders in the background.")}</p><div className="progress-bar"><span style={{ width: `${active.progress}%` }}/></div>{active.status === "SUCCEEDED" && <Link className="button small" href={`/generations/${active.id}`}>Open generation <ArrowRight size={14}/></Link>}</div>
    </section>}

    <form id="generation-form" onSubmit={handleSubmit(onSubmit, onInvalid)} className="creator-layout">
      <div className="creator-main stack">
        <section className="panel composer-panel">
          <div className="panel-header"><div className="step-heading"><span>1</span><div><h2>Describe your idea</h2><p className="section-copy">Write naturally, then tap a reference image to tag it right inside the prompt.</p></div></div><button className="button small ghost" type="button" disabled={!values.prompt || enhance.isPending} onClick={() => enhance.mutate()}><WandSparkles size={14}/>{enhance.isPending ? "Enhancing…" : "Enhance"}</button></div>
          <div className="panel-body stack">
            <input type="hidden" {...register("prompt")}/>
            <div className="prompt-composer" ref={composerRef}>
              <div
                ref={promptEditorRef}
                className="rich-prompt"
                role="textbox"
                aria-multiline="true"
                aria-label="Prompt"
                contentEditable
                suppressContentEditableWarning
                data-empty={promptLength === 0}
                data-placeholder={mode === "product" ? "A premium perfume bottle rises through soft mist as the camera slowly orbits…" : mode === "3d" ? "A tiny astronaut explores a colorful 3D planet with floating islands…" : mode === "image" ? "Describe how your image should move and how the camera should behave…" : "A cinematic scene of… type @ to tag a reference image, or tap one below."}
                onInput={() => { renumberChips(); syncFromEditor(); if (mentionEnabled) detectMention(); else closeMention(); }}
                onKeyDown={onPromptKeyDown}
                onKeyUp={() => { saveSelection(); if (mentionEnabled) detectMention(); }}
                onMouseUp={() => { saveSelection(); if (mentionEnabled) detectMention(); }}
                onBlur={() => { saveSelection(); syncFromEditor(); setTimeout(() => closeMention(), 120); }}
                onPaste={(event) => { event.preventDefault(); const text = event.clipboardData.getData("text/plain"); document.execCommand("insertText", false, text); }}
              />
              {mention && mentionEnabled && mentionMatches.length > 0 && (
                <div className="mention-menu" style={{ left: mention.left, top: mention.top }} role="listbox" aria-label="Tag a reference">
                  <span className="mention-head"><AtSign size={12}/>Tag a reference</span>
                  {mentionMatches.map((asset, index) => (
                    <button type="button" key={asset.id} role="option" aria-selected={index === mentionIndex} className={`mention-item ${index === mentionIndex ? "active" : ""} ${taggedAssetIds.includes(asset.id) ? "tagged" : ""}`}
                      onMouseEnter={() => setMentionIndex(index)}
                      onMouseDown={(event) => { event.preventDefault(); confirmMention(asset); }}>
                      {asset.type === "IMAGE" && asset.url ? <img src={asset.url} alt="" draggable={false}/> : <span className="mention-fallback">{asset.type === "VIDEO" ? <Video size={13}/> : asset.type === "AUDIO" ? <Music2 size={13}/> : <ImagePlus size={13}/>}</span>}
                      <span className="mention-name">{asset.originalName}</span>
                      {taggedAssetIds.includes(asset.id) && <span className="mention-tagged">[{taggedAssetIds.indexOf(asset.id) + 1}]</span>}
                    </button>
                  ))}
                </div>
              )}
              <span className="prompt-count">{promptLength} / 4000</span>
              <button type="button" className="prompt-magic" disabled={!values.prompt} onClick={() => enhance.mutate()} aria-label="Enhance prompt"><Sparkles size={15}/></button>
            </div>
            {errors.prompt && <div className="alert">{errors.prompt.message}</div>}
            <div className="idea-row"><span><Lightbulb size={13}/>Try an idea</span><div>{promptIdeas.slice(0, 3).map((idea, index) => <button type="button" key={idea} onClick={() => setPlainPrompt(idea)}>{index + 1}</button>)}</div><small>{promptIdeas.find((idea) => idea === values.prompt) || "Pick a starter, then make it yours."}</small></div>
            {model?.capabilities.referenceImages && optionsFor("IMAGE").length > 0 && <div className="prompt-tagger"><span><Tag size={13}/>Tap an image to tag it, or type @ in your prompt <small>Tag the same image multiple times to reference it in different places</small></span><div className="ref-image-strip">{optionsFor("IMAGE").map((asset) => <RefImageCard key={asset.id} asset={asset} index={taggedAssetIds.indexOf(asset.id)} tagged={taggedAssetIds.includes(asset.id)} onToggle={() => insertImageChip(asset)}/>)}</div></div>}
            {taggableRefs.length > 0 && <div className="prompt-references"><span>Tag a reference</span>{taggableRefs.map((asset) => <button type="button" key={asset.id} className={taggedAssetIds.includes(asset.id) ? "tagged" : ""} onClick={() => insertImageChip(asset)}>{asset.type === "VIDEO" ? <Video size={12}/> : <Music2 size={12}/>}{asset.originalName}{taggedAssetIds.includes(asset.id) && <span className="ref-num">[{taggedAssetIds.indexOf(asset.id) + 1}]</span>}</button>)}</div>}
          </div>
        </section>

        <section className="panel reference-panel">
          <div className="panel-header"><div className="step-heading"><span>2</span><div><h2>Add visual references <em>Optional</em></h2><p className="section-copy">Guide the character, opening frame, movement, or soundtrack.</p></div></div><Link href="/assets" className="button small ghost">Browse library</Link></div>
          <div className="panel-body stack">
            <div className="reference-grid enhanced"><UploadCard type="IMAGE" icon={<ImagePlus/>} label={mode === "image" ? "Upload image to animate" : "Add an image"} accept="image/jpeg,image/png,image/webp" upload={upload}/>{model?.capabilities.referenceVideos && <UploadCard type="VIDEO" icon={<Video/>} label="Add motion reference" accept="video/mp4,video/webm,video/quicktime" upload={upload}/>} {model?.capabilities.referenceAudio && <UploadCard type="AUDIO" icon={<Music2/>} label="Add audio reference" accept="audio/mpeg,audio/wav,audio/mp4,audio/aac" upload={upload}/>}</div>
            {values.imageAssetId && <SelectedAsset asset={assets.find((item) => item.id === values.imageAssetId)} label="Opening image" onRemove={() => setValue("imageAssetId", "")}/>} 
            {model?.capabilities.imageToVideo && <div className="two-col"><AssetSelect label="Opening image" assets={optionsFor("IMAGE")} value={values.imageAssetId || ""} onChange={(value) => setValue("imageAssetId", value)}/>{model.capabilities.firstLastFrame && <AssetSelect label="End frame" assets={optionsFor("IMAGE")} value={values.lastFrameAssetId || ""} onChange={(value) => setValue("lastFrameAssetId", value)}/>}</div>}
            {taggedAssetIds.length > 0 && <div className="tagged-summary"><Tag size={12}/>{taggedAssetIds.length} reference{taggedAssetIds.length > 1 ? "s" : ""} tagged in your prompt</div>}
            {(model?.capabilities.referenceVideos || model?.capabilities.referenceAudio) && <details className="advanced"><summary>More reference controls</summary><div className="three-col advanced-fields">{model.capabilities.referenceVideos && <MultiAssetSelect label="Videos" assets={optionsFor("VIDEO")} values={values.referenceVideoAssetIds} max={model.maxReferenceVideos} onChange={(value) => setValue("referenceVideoAssetIds", value)}/>} {model.capabilities.referenceAudio && <MultiAssetSelect label="Audio" assets={optionsFor("AUDIO")} values={values.referenceAudioAssetIds} max={model.maxReferenceAudio} onChange={(value) => setValue("referenceAudioAssetIds", value)}/>}</div></details>}
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
            <Choice label="Length" values={model?.durations || [5, 10, 15, 30]} current={values.duration} format={(value) => `${value}s`} onChange={(value) => setValue("duration", value)}/>
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
          <button className="button primary generate-button" type="submit" disabled={!generationReady || !imageReady || isSubmitting || generationInFlight}>{create.isPending ? <><span className="spinner"/>Queuing…</> : generationInFlight ? <><span className="spinner"/>Generating…</> : <><Play size={16} fill="currentColor"/>Generate video <kbd>Ctrl ↵</kbd></>}</button>
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
function UploadCard({ type, icon, label, accept, upload }: { type: "IMAGE" | "VIDEO" | "AUDIO"; icon: React.ReactNode; label: string; accept: string; upload: (files: File[], type: "IMAGE" | "VIDEO" | "AUDIO") => void }) { return <label className="upload-card"><span className="upload-icon">{icon}</span><strong>{label}</strong><small>Drop here or browse · multiple files · 100 MB each</small><input type="file" accept={accept} multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); if (files.length) void upload(files, type); event.target.value = ""; }}/></label>; }
function RefImageCard({ asset, index, tagged, onToggle }: { asset: Asset; index: number; tagged: boolean; onToggle: () => void }) {
  return <button type="button" className={`ref-image-card ${tagged ? "tagged" : ""}`} onClick={onToggle} title={tagged ? `Tagged as [${index + 1}] — tap to add it again` : `Tap to tag ${asset.originalName}`} aria-pressed={tagged}>
    <img src={asset.url} alt={asset.originalName} draggable={false}/>
    <span className="ref-image-badge">{tagged ? `[${index + 1}]` : <Tag size={12}/>}</span>
    <small>{asset.originalName}</small>
  </button>;
}
function SelectedAsset({ asset, label, onRemove }: { asset?: Asset; label: string; onRemove: () => void }) { if (!asset) return null; return <div className="selected-asset"><div>{asset.type === "IMAGE" ? <img src={asset.url} alt=""/> : <Clapperboard size={18}/>}</div><span><strong>{label}</strong><small>{asset.originalName}</small></span><button type="button" className="icon-button" onClick={onRemove} aria-label={`Remove ${label}`}><X size={13}/></button></div>; }
function AssetSelect({ label, assets, value, onChange }: { label: string; assets: Asset[]; value: string; onChange: (value: string) => void }) { return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Not selected</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.originalName}</option>)}</select></label>; }
function MultiAssetSelect({ label, assets, values, max, onChange }: { label: string; assets: Asset[]; values: string[]; max: number; onChange: (value: string[]) => void }) { return <div className="field"><span>{label}<small className="field-help">{values.length}/{max}</small></span><select value="" onChange={(event) => { if (event.target.value && !values.includes(event.target.value) && values.length < max) onChange([...values, event.target.value]); }}><option value="">Add asset…</option>{assets.filter((asset) => !values.includes(asset.id)).map((asset) => <option key={asset.id} value={asset.id}>{asset.originalName}</option>)}</select><div className="chips">{values.map((id, index) => <span className="chip" key={id}>{label.replace(/s$/, "")} {index + 1}<button type="button" onClick={() => onChange(values.filter((value) => value !== id))}><X size={10}/></button></span>)}</div></div>; }
// Translate cryptic provider errors into actionable guidance.
function friendlyError(message?: string | null) {
  if (!message) return null;
  if (message.includes("E005") || /flagged as sensitive/i.test(message)) return "The model's safety filter flagged your prompt or a reference image. This is common with realistic AI faces/people on Seedance — try a different reference image, remove references, reword the prompt, or switch to MiniMax H3.";
  if (message.includes("429") || /throttled|rate limit/i.test(message)) return "Replicate is rate-limiting your account (this happens while your balance is under $5). Wait a few seconds and try again, or top up credit to lift the limit.";
  if (/insufficient|payment|quota|billing/i.test(message)) return "Replicate reported a billing/quota problem. Check your Replicate account credit, then try again.";
  return message;
}
function aspectLabel(value: string) { const labels: Record<string, string> = { "16:9": "16:9 Landscape", "9:16": "9:16 Vertical", "1:1": "1:1 Square", "4:5": "4:5 Portrait", "5:4": "5:4 Landscape", "3:4": "3:4 Portrait", "4:3": "4:3 Classic", "2:3": "2:3 Portrait", "3:2": "3:2 Photo", "1.91:1": "1.91:1 LinkedIn", "16:10": "16:10 Wide", "21:9": "21:9 Cinema", adaptive: "Adaptive" }; return labels[value] || value; }
function ratioUse(value: string) { return ({ "16:9": "YouTube", "9:16": "Reels", "1:1": "Square", "4:5": "Feed" } as Record<string, string>)[value] || "Custom"; }
