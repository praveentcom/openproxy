/**
 * Usage object for logging.
 *
 * @param prompt_tokens: The number of prompt tokens.
 * @param completion_tokens: The number of completion tokens.
 * @param total_tokens: The total number of tokens.
 * @param prompt_tokens_details: The details of the prompt tokens.
 * @returns The usage object.
 */
export type Usage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
};

/**
 * Cost configuration for a model.
 *
 * @param input: The cost per million prompt tokens (USD).
 * @param cached: The cost per million cached tokens (USD).
 * @param output: The cost per million completion tokens (USD).
 * @returns The cost configuration.
 */
export type CostConfig = {
  input: number;
  cached: number;
  output: number;
};

/**
 * Model pricing table.
 *
 * @param models: Canonical model pricing.
 * @param aliases: Alias to canonical model mapping.
 * @returns The pricing table.
 */
export type ModelCostTable = Record<string, CostConfig>;

/**
 * Helicone API response types
 */
interface HeliconeModelCost {
  provider: string;
  model: string;
  operator: "equals" | "startsWith" | "includes";
  input_cost_per_1m: number;
  output_cost_per_1m: number;
  prompt_cache_write_per_1m?: number;
  prompt_cache_read_per_1m?: number;
  show_in_playground?: boolean;
}

interface HeliconeApiResponse {
  metadata: {
    total_models: number;
  };
  data: HeliconeModelCost[];
}

/**
 * Internal storage for cost data with matching operators
 */
interface CostEntry {
  operator: "equals" | "startsWith" | "includes";
  config: CostConfig;
}

// Storage for Helicone costs (loaded at runtime)
let heliconeCosts: Map<string, CostEntry> = new Map();
let heliconeCostsLoaded = false;

/**
 * ============================================================================
 * CUSTOM MODEL COSTS
 * ============================================================================
 * 
 * Add your custom model costs here. These will take precedence over costs
 * fetched from the Helicone API. This is useful for:
 * 
 * - Custom/fine-tuned models (e.g., "zlm-4.6")
 * - Self-hosted models with custom pricing
 * - Overriding Helicone costs for specific models
 * - Models not yet in the Helicone database
 * 
 * Format:
 *   "model-name": { input: <cost>, cached: <cost>, output: <cost> }
 * 
 * All costs are in USD per million tokens.
 * 
 * @example
 * ```ts
 * export const CUSTOM_MODEL_COSTS: ModelCostTable = {
 *   "zlm-4.6": { input: 2.5, cached: 1.25, output: 10 },
 *   "zlm-4.5-air": { input: 0.15, cached: 0.075, output: 0.6 },
 * };
 * ```
 */
export const CUSTOM_MODEL_COSTS: ModelCostTable = {
  // Add your custom model costs here
};

/**
 * Fetches and loads cost data from the Helicone API.
 * This should be called once at application startup.
 * 
 * @returns Promise that resolves when costs are loaded
 */
export async function loadHeliconeCosts(): Promise<void> {
  try {
    const response = await fetch("https://www.helicone.ai/api/llm-costs");
    
    if (!response.ok) {
      throw new Error(`Helicone API returned ${response.status}: ${response.statusText}`);
    }

    const data: HeliconeApiResponse = await response.json();
    
    heliconeCosts.clear();
    for (const model of data.data) {
      const config: CostConfig = {
        input: model.input_cost_per_1m ?? 0,
        output: model.output_cost_per_1m ?? 0,
        cached: model.prompt_cache_read_per_1m ?? model.input_cost_per_1m ?? 0,
      };

      heliconeCosts.set(model.model.toLowerCase(), {
        operator: model.operator,
        config,
      });
    }

    heliconeCostsLoaded = true;
    console.log(`\x1b[96m  🌎 Loaded ${data.metadata.total_models} model costs from Helicone API\x1b[0m`);
  } catch (error) {
    console.warn(`\x1b[33m  ⚠️  Failed to load Helicone costs: ${error instanceof Error ? error.message : error}\x1b[0m`);
  }
}

/**
 * Gets the cost configuration for a model.
 * 
 * Priority order:
 * 1. Custom model costs (CUSTOM_MODEL_COSTS)
 * 2. Helicone API costs (with operator matching)
 * 3. Fallback cost
 * 
 * @param model: The model name to look up
 * @returns The cost configuration for the model
 */
export function getCostConfig(model: string): CostConfig {
  const normalizedModel = model.toLowerCase();

  /**
   * Check custom costs first (highest priority)
   */
  if (CUSTOM_MODEL_COSTS[normalizedModel]) {
    return CUSTOM_MODEL_COSTS[normalizedModel];
  } else if (CUSTOM_MODEL_COSTS[model]) {
    return CUSTOM_MODEL_COSTS[model];
  }

  /**
   * Check Helicone costs with operator matching
   */
  const exactMatch = heliconeCosts.get(normalizedModel);
  if (exactMatch && exactMatch.operator === "equals") {
    return exactMatch.config;
  }

  for (const [pattern, entry] of heliconeCosts) {
    if (entry.operator === "startsWith" && normalizedModel.startsWith(pattern)) {
      return entry.config;
    }
  }

  for (const [pattern, entry] of heliconeCosts) {
    if (entry.operator === "includes" && normalizedModel.includes(pattern)) {
      return entry.config;
    }
  }

  if (exactMatch) {
    return exactMatch.config;
  }

  /**
   * Return fallback since no matching cost was found
   */
  return { input: 0, cached: 0, output: 0 };
}

/**
 * Computes the total cost (in USD) for a given model and usage.
 *
 * @param model: The model to compute the cost for.
 * @param usage: The usage object.
 * @returns The total cost (in USD), or null if no usage data.
 */
export function calculateCost(
  model: string,
  usage?: Usage
): number | null {
  if (!usage) return null;

  const {
    prompt_tokens = 0,
    completion_tokens = 0,
    prompt_tokens_details = { cached_tokens: 0 },
  } = usage;

  const cost = getCostConfig(model);

  let inputCost = 0, cachedCost = 0;

  if (prompt_tokens_details.cached_tokens && cost.cached > 0) {
    cachedCost =
      (prompt_tokens_details.cached_tokens / 1_000_000) * cost.cached;
    inputCost =
      ((prompt_tokens - prompt_tokens_details.cached_tokens) / 1_000_000) *
      cost.input;
  } else {
    inputCost = (prompt_tokens / 1_000_000) * cost.input;
  }

  const outputCost =
    (completion_tokens / 1_000_000) * cost.output;

  const total = inputCost + cachedCost + outputCost;
  return total > 0 ? Number(total.toFixed(6)) : null;
}
