import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/config/unifiedConfig";

export const anthropic = new Anthropic({
  apiKey: config.ai.anthropicApiKey,
});

export const ANTHROPIC_MODEL = config.ai.anthropicModel;
