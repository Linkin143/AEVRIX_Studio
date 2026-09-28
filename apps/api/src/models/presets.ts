import type { Preset } from "@aevrix/shared-types";

const preset = (id: string, name: string, description: string, aspectRatio: string, promptModifier: string): Preset => ({ id, name, description, modelId: "seedance-2.0", aspectRatio, duration: id === "social-reel" ? 7 : 10, resolution: "720p", promptModifier, generateAudio: true });
export const PRESETS = [
  preset("cinematic", "Cinematic", "Film-grade movement and light", "16:9", "cinematic composition, nuanced natural motion, filmic lighting"),
  preset("commercial", "Commercial", "Polished campaign treatment", "16:9", "premium commercial cinematography, crisp product-focused composition"),
  preset("product-ad", "Product Ad", "Hero product storytelling", "16:9", "hero product shot, controlled camera orbit, pristine studio detail"),
  preset("luxury", "Luxury", "Refined editorial atmosphere", "16:9", "luxury editorial aesthetic, refined materials, elegant slow camera motion"),
  preset("food", "Food", "Appetizing macro detail", "16:9", "appetizing macro photography, tactile detail, warm directional light"),
  preset("fashion", "Fashion", "Editorial movement", "9:16", "high-fashion editorial, confident movement, sculpted light"),
  preset("automotive", "Automotive", "Dynamic vehicle imagery", "21:9", "automotive commercial, dynamic tracking camera, realistic reflections"),
  preset("social-reel", "Social Reel", "Fast vertical storytelling", "9:16", "vertical social reel, immediate visual hook, energetic pacing"),
];
