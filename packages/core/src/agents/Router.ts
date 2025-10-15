/**
 * @license
 * Copyright 2025 Gemini CLI
 * SPDX-License-Identifier: MIT
 */

import * as fs from 'node:fs';
import type { Config } from '../config/config.js';
import { Storage } from '../config/storage.js';
import type { AgentManager } from './AgentManager.js';
import type { ModelService } from '../services/modelService.js';
import { RuleRouter } from './RuleRouter.js';
import { LLMRouter } from './LLMRouter.js';
import { HybridRouter } from './HybridRouter.js';
import type { RoutingConfig, RoutingScore } from './types.js';

/**
 * Default routing configuration
 */
const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  enabled: false,
  strategy: 'hybrid',
  rule: {
    confidence_threshold: 70,
  },
  llm: {
    model: 'gemini-2.0-flash',
    timeout: 5000,
  },
  fallback: 'prompt_user',
};

/**
 * Main router class that manages routing configuration and delegates to specific routers
 *
 * Configuration priority (highest to lowest):
 * 1. Runtime parameters (passed directly to route method)
 * 2. Environment variables (GEMINI_ROUTING_*)
 * 3. Project config (.gemini/settings.json)
 * 4. Global config (~/.gemini/settings.json)
 * 5. Default values
 */
export class Router {
  private config: RoutingConfig;
  private ruleRouter: RuleRouter;
  private llmRouter: LLMRouter;
  private hybridRouter: HybridRouter;

  constructor(
    private cliConfig: Config,
    agentManager: AgentManager,
    modelService: ModelService,
    runtimeConfig?: Partial<RoutingConfig>
  ) {
    // Load configuration with proper priority
    this.config = this.loadConfiguration(runtimeConfig);

    // If no LLM model specified in config, use current session model as default
    if (!this.config.llm.model || this.config.llm.model === 'gemini-2.0-flash') {
      const currentModel = this.cliConfig.getModel();
      if (currentModel) {
        this.config.llm.model = currentModel;
        console.log(`[Router] Using current session model for routing: ${currentModel}`);
      }
    }

    // Initialize routers
    this.ruleRouter = new RuleRouter(agentManager);
    this.llmRouter = new LLMRouter(agentManager, modelService, this.config.llm);
    this.hybridRouter = new HybridRouter(
      this.ruleRouter,
      this.llmRouter,
      this.config.rule.confidence_threshold
    );

    console.log('[Router] Initialized with config:', this.config);
  }

  /**
   * Route user input to the best matching agent
   * @param userInput User's input text
   * @param strategyOverride Optional strategy override for this specific call
   * @returns Best matching agent score or null if routing is disabled or no match
   */
  async route(
    userInput: string,
    strategyOverride?: 'rule' | 'llm' | 'hybrid'
  ): Promise<RoutingScore | null> {
    if (!this.config.enabled) {
      console.log('[Router] Routing is disabled');
      return null;
    }

    const strategy = strategyOverride || this.config.strategy;
    console.log(`[Router] Using strategy: ${strategy}`);

    try {
      let result: RoutingScore | null = null;

      switch (strategy) {
        case 'rule':
          result = await this.ruleRouter.route(userInput);
          break;
        case 'llm':
          result = await this.llmRouter.route(userInput);
          break;
        case 'hybrid':
          result = await this.hybridRouter.route(userInput);
          break;
        default:
          console.warn(`[Router] Unknown strategy: ${strategy}, falling back to hybrid`);
          result = await this.hybridRouter.route(userInput);
      }

      if (result) {
        console.log(
          `[Router] Routed to agent: ${result.agent.name} (confidence: ${result.confidence})`
        );
      } else {
        console.log('[Router] No matching agent found');
      }

      return result;
    } catch (error) {
      console.error('[Router] Error during routing:', error);
      return null;
    }
  }

  /**
   * Load routing configuration from multiple sources with proper priority
   */
  private loadConfiguration(runtimeConfig?: Partial<RoutingConfig>): RoutingConfig {
    // Start with defaults
    let config = { ...DEFAULT_ROUTING_CONFIG };

    // 1. Load global config (~/.gemini/settings.json)
    const globalSettings = this.loadGlobalSettings();
    if (globalSettings?.routing) {
      config = this.mergeConfigs(config, globalSettings.routing);
      console.log('[Router] Loaded global routing config');
    }

    // 2. Load project config (.gemini/settings.json)
    const projectSettings = this.loadProjectSettings();
    if (projectSettings?.routing) {
      config = this.mergeConfigs(config, projectSettings.routing);
      console.log('[Router] Loaded project routing config');
    }

    // 3. Load environment variables
    const envConfig = this.loadEnvironmentConfig();
    if (Object.keys(envConfig).length > 0) {
      config = this.mergeConfigs(config, envConfig);
      console.log('[Router] Loaded environment routing config');
    }

    // 4. Apply runtime config (highest priority)
    if (runtimeConfig) {
      config = this.mergeConfigs(config, runtimeConfig);
      console.log('[Router] Applied runtime routing config');
    }

    return config;
  }

  /**
   * Load global settings from ~/.gemini/settings.json
   */
  private loadGlobalSettings(): any {
    try {
      const globalSettingsPath = Storage.getGlobalSettingsPath();
      if (fs.existsSync(globalSettingsPath)) {
        const content = fs.readFileSync(globalSettingsPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('[Router] Failed to load global settings:', error);
    }
    return null;
  }

  /**
   * Load project settings from .gemini/settings.json
   */
  private loadProjectSettings(): any {
    try {
      const storage = new Storage(this.cliConfig.getTargetDir());
      const projectSettingsPath = storage.getWorkspaceSettingsPath();
      if (fs.existsSync(projectSettingsPath)) {
        const content = fs.readFileSync(projectSettingsPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('[Router] Failed to load project settings:', error);
    }
    return null;
  }

  /**
   * Load routing configuration from environment variables
   * Supported variables:
   * - GEMINI_ROUTING_ENABLED (true/false)
   * - GEMINI_ROUTING_STRATEGY (rule/llm/hybrid)
   * - GEMINI_ROUTING_CONFIDENCE_THRESHOLD (0-100)
   * - GEMINI_ROUTING_LLM_MODEL (model name)
   * - GEMINI_ROUTING_LLM_TIMEOUT (milliseconds)
   * - GEMINI_ROUTING_FALLBACK (none/prompt_user/default_agent)
   */
  private loadEnvironmentConfig(): Partial<RoutingConfig> {
    const config: Partial<RoutingConfig> = {};
    const env = process.env;

    if (env['GEMINI_ROUTING_ENABLED'] !== undefined) {
      config.enabled = env['GEMINI_ROUTING_ENABLED'] === 'true';
    }

    if (env['GEMINI_ROUTING_STRATEGY']) {
      const strategy = env['GEMINI_ROUTING_STRATEGY'];
      if (strategy === 'rule' || strategy === 'llm' || strategy === 'hybrid') {
        config.strategy = strategy;
      }
    }

    if (env['GEMINI_ROUTING_CONFIDENCE_THRESHOLD']) {
      const threshold = parseInt(env['GEMINI_ROUTING_CONFIDENCE_THRESHOLD'], 10);
      if (!isNaN(threshold) && threshold >= 0 && threshold <= 100) {
        config.rule = { confidence_threshold: threshold };
      }
    }

    if (env['GEMINI_ROUTING_LLM_MODEL'] || env['GEMINI_ROUTING_LLM_TIMEOUT']) {
      config.llm = {
        model: env['GEMINI_ROUTING_LLM_MODEL'] || DEFAULT_ROUTING_CONFIG.llm.model,
        timeout: env['GEMINI_ROUTING_LLM_TIMEOUT']
          ? parseInt(env['GEMINI_ROUTING_LLM_TIMEOUT'], 10)
          : DEFAULT_ROUTING_CONFIG.llm.timeout,
      };
    }

    if (env['GEMINI_ROUTING_FALLBACK']) {
      const fallback = env['GEMINI_ROUTING_FALLBACK'];
      if (fallback === 'none' || fallback === 'prompt_user' || fallback === 'default_agent') {
        config.fallback = fallback;
      }
    }

    return config;
  }

  /**
   * Deep merge two configuration objects
   */
  private mergeConfigs(
    base: RoutingConfig,
    override: Partial<RoutingConfig>
  ): RoutingConfig {
    return {
      enabled: override.enabled !== undefined ? override.enabled : base.enabled,
      strategy: override.strategy || base.strategy,
      rule: {
        confidence_threshold:
          override.rule?.confidence_threshold !== undefined
            ? override.rule.confidence_threshold
            : base.rule.confidence_threshold,
      },
      llm: {
        model: override.llm?.model || base.llm.model,
        timeout: override.llm?.timeout !== undefined ? override.llm.timeout : base.llm.timeout,
      },
      fallback: override.fallback || base.fallback,
    };
  }

  /**
   * Get current routing configuration
   */
  getConfig(): RoutingConfig {
    return { ...this.config };
  }

  /**
   * Update routing configuration (runtime changes only, does not persist)
   */
  updateConfig(updates: Partial<RoutingConfig>): void {
    this.config = this.mergeConfigs(this.config, updates);

    // Update hybrid router threshold if changed
    if (updates.rule?.confidence_threshold !== undefined) {
      this.hybridRouter.setConfidenceThreshold(updates.rule.confidence_threshold);
    }

    console.log('[Router] Updated runtime config:', this.config);
  }

  /**
   * Enable routing
   */
  enable(): void {
    this.config.enabled = true;
    console.log('[Router] Routing enabled');
  }

  /**
   * Disable routing
   */
  disable(): void {
    this.config.enabled = false;
    console.log('[Router] Routing disabled');
  }

  /**
   * Check if routing is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}
