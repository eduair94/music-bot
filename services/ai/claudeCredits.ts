/**
 * Claude calls on the owner's plan credit keys.
 *
 * Each key in CLAUDE_CREDIT_KEYS belongs to a Claude Console organization
 * linked to a Claude plan, so its calls draw that plan's monthly included API
 * credits (they expire every billing cycle). Calls rotate across the keys and
 * skip any key that is out of credits, rejected, rate limited or over its
 * monthly cap; when none can answer, the caller gets null and tells the user
 * the AI is unavailable. ANTHROPIC_API_KEY is used only when no credit key is
 * configured.
 *
 * Env:
 *   CLAUDE_CREDIT_KEYS                 "label=sk-ant-...,label2=sk-ant-..." (or bare keys)
 *   CLAUDE_CREDIT_KEY_MONTHLY_CAP_USD  estimated spend per key per month before it is
 *                                      skipped (default 90; 0 = no cap). Keeps purchased
 *                                      credits on the same organization from being spent.
 *   CLAUDE_CREDIT_EXHAUSTED_RETRY_MIN  rest for a key that ran out (default 360)
 *
 * Ported from shop-search-engine/api/classes/ClaudeCredits.ts.
 */
import Anthropic from "@anthropic-ai/sdk";
import { ClaudeUsage } from "../../models/ClaudeUsage";

export interface CreditKey {
  label: string;
  apiKey: string;
}

export type ClaudeEffort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ClaudeJsonRequest {
  /** Stored with the usage row ("ai_playlist"). */
  feature: string;
  model: string;
  system: string;
  prompt: string;
  /** JSON Schema the answer must match (structured outputs). */
  schema: Record<string, unknown>;
  maxTokens: number;
  effort?: ClaudeEffort;
  timeoutMs?: number;
}

export interface ClaudeJsonResult<T> {
  data: T;
  model: string;
  key: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** Why a call returned nothing, for logs and the user-facing message. */
export type ClaudeFailure = "unconfigured" | "unavailable" | "refused" | "truncated" | "invalid" | "error";

export class ClaudeCallError extends Error {
  constructor(public readonly reason: ClaudeFailure, message?: string) {
    super(message ?? reason);
    this.name = "ClaudeCallError";
  }
}

/** Models that take `fallbacks: "default"` (a refusal is retried server-side on another model). */
const SERVER_FALLBACK_MODELS = new Set(["claude-fable-5-2", "claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

/** USD per token. Unknown models are priced as Opus so the cap errs high. */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1 / 1e6, output: 0.5 / 1e6 },
  "claude-sonnet-5-5": { input: 2 / 1e6, output: 10 / 1e6 },
  "claude-sonnet-5": { input: 2 / 1e6, output: 10 / 1e6 },
  "claude-opus-5-5": { input: 4 / 1e6, output: 20 / 1e6 },
  "claude-opus-5": { input: 5 / 1e6, output: 25 / 1e6 },
  "claude-opus-4-8": { input: 5 / 1e6, output: 25 / 1e6 }
};
const DEFAULT_PRICING = { input: 5 / 1e6, output: 25 / 1e6 };

export function estimateClaudeCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] || DEFAULT_PRICING;
  return inputTokens * p.input + outputTokens * p.output;
}

/** Pure: parse CLAUDE_CREDIT_KEYS. Labels default to k1, k2, … in order. */
export function parseCreditKeys(raw: string | undefined): CreditKey[] {
  const seen = new Set<string>();
  const keys: CreditKey[] = [];
  for (const item of String(raw || "").split(/[\s,;]+/)) {
    if (!item) continue;
    const eq = item.indexOf("=");
    const label = eq > 0 ? item.slice(0, eq).trim() : "";
    const apiKey = (eq > 0 ? item.slice(eq + 1) : item).trim();
    if (!apiKey || seen.has(apiKey)) continue;
    seen.add(apiKey);
    keys.push({ label: label || `k${keys.length + 1}`, apiKey });
  }
  return keys;
}

export type ClaudeErrorKind = "credits" | "auth" | "rate" | "transient" | "fatal";

/**
 * Pure: what an API error says about the KEY. Only `credits`, `auth` and
 * `rate` are specific to one organization, so only those move on to the next
 * key; the same bad request or an API-wide outage would fail on every key.
 */
export function classifyClaudeError(err: any): ClaudeErrorKind {
  const status: number | undefined = typeof err?.status === "number" ? err.status : undefined;
  const msg = String(err?.message || err || "");
  if (
    status === 402 ||
    /credit balance is too low/i.test(msg) ||
    /reached your specified API usage limits/i.test(msg) ||
    err?.type === "billing_error"
  ) {
    return "credits";
  }
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate";
  if (status === undefined || status === 408 || status === 409 || status >= 500) return "transient";
  return "fatal";
}

/** Pure: when a Console spend limit lifts ("You will regain access on 2026-12-01 at 00:00 UTC"). */
export function regainAccessAt(err: any): number | undefined {
  const m = /regain access on (\d{4}-\d{2}-\d{2}) at (\d{2}:\d{2}) UTC/i.exec(String(err?.message || err || ""));
  if (!m) return undefined;
  const t = Date.parse(`${m[1]}T${m[2]}:00Z`);
  return Number.isFinite(t) ? t : undefined;
}

function retryAfterMs(err: any): number | undefined {
  const h = err?.headers;
  const raw = typeof h?.get === "function" ? h.get("retry-after") : h?.["retry-after"];
  const secs = parseFloat(String(raw ?? ""));
  return Number.isFinite(secs) && secs > 0 ? secs * 1000 : undefined;
}

/**
 * Pure: the Messages request body. Thinking is left at the model's default
 * (Claude Opus 5.5 can't turn it off; effort is the lever).
 */
export function buildClaudeParams(req: ClaudeJsonRequest): Record<string, unknown> {
  return {
    model: req.model,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: [{ role: "user", content: req.prompt }],
    output_config: {
      ...(req.effort ? { effort: req.effort } : {}),
      format: { type: "json_schema", schema: req.schema }
    },
    ...(SERVER_FALLBACK_MODELS.has(req.model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {})
  };
}

/**
 * Tokens billed for the call, cache reads/writes counted as input. When a
 * server-side fallback finished the answer the declined attempt was billed
 * too, so every sampled iteration is added up.
 */
export function sumUsage(u: any): { inputTokens: number; outputTokens: number } {
  const one = (x: any) => ({
    inputTokens: (x?.input_tokens || 0) + (x?.cache_read_input_tokens || 0) + (x?.cache_creation_input_tokens || 0),
    outputTokens: x?.output_tokens || 0
  });
  const iterations = (Array.isArray(u?.iterations) ? u.iterations : []).filter(
    (it: any) => it?.type === "message" || it?.type === "fallback_message"
  );
  if (!iterations.some((it: any) => it.type === "fallback_message")) return one(u);
  return iterations.reduce(
    (sum: { inputTokens: number; outputTokens: number }, it: any) => {
      const v = one(it);
      return { inputTokens: sum.inputTokens + v.inputTokens, outputTokens: sum.outputTokens + v.outputTokens };
    },
    { inputTokens: 0, outputTokens: 0 }
  );
}

interface KeyState {
  key: CreditKey;
  client: Pick<Anthropic, "beta"> | null;
  restUntil: number;
  restReason: string;
}

export interface UsageStore {
  spendByKey(month: string): Promise<Record<string, number>>;
  record(row: { month: string; key: string; feature: string; model: string; inputTokens: number; outputTokens: number; costUsd: number }): Promise<void>;
}

const mongoUsageStore: UsageStore = {
  async spendByKey(month) {
    const rows: Array<{ _id: string; cost: number }> = await ClaudeUsage.aggregate([
      { $match: { month } },
      { $group: { _id: "$key", cost: { $sum: "$costUsd" } } }
    ]).exec();
    return Object.fromEntries(rows.map((r) => [r._id, r.cost || 0]));
  },
  async record(row) {
    await ClaudeUsage.create({ ...row, createdAt: new Date() });
  }
};

export interface ClaudeCreditsOptions {
  keys?: CreditKey[];
  monthlyCapUsd?: number;
  exhaustedRetryMs?: number;
  store?: UsageStore;
  makeClient?: (apiKey: string) => Pick<Anthropic, "beta">;
  now?: () => number;
}

function envNumber(name: string, fallback: number): number {
  const n = parseFloat(process.env[name] || "");
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function defaultKeys(): CreditKey[] {
  const pool = parseCreditKeys(process.env.CLAUDE_CREDIT_KEYS);
  if (pool.length) return pool;
  return process.env.ANTHROPIC_API_KEY ? [{ label: "env", apiKey: process.env.ANTHROPIC_API_KEY }] : [];
}

export class ClaudeCredits {
  private readonly states: KeyState[];
  private readonly monthlyCapUsd: number;
  private readonly exhaustedRetryMs: number;
  private readonly store: UsageStore;
  private readonly makeClient: (apiKey: string) => Pick<Anthropic, "beta">;
  private readonly now: () => number;
  private cursor = 0;
  private spendMonth = "";
  private spend: Record<string, number> = {};
  private spendExpiry = 0;
  private spendFailUntil = 0;

  constructor(opts: ClaudeCreditsOptions = {}) {
    const keys = opts.keys ?? defaultKeys();
    this.states = keys.map((key) => ({ key, client: null, restUntil: 0, restReason: "" }));
    this.monthlyCapUsd = opts.monthlyCapUsd ?? envNumber("CLAUDE_CREDIT_KEY_MONTHLY_CAP_USD", 90);
    this.exhaustedRetryMs = opts.exhaustedRetryMs ?? envNumber("CLAUDE_CREDIT_EXHAUSTED_RETRY_MIN", 360) * 60_000;
    this.store = opts.store ?? mongoUsageStore;
    this.now = opts.now ?? Date.now;
    // Rotation is the retry strategy: one attempt per key.
    this.makeClient = opts.makeClient ?? ((apiKey) => new Anthropic({ apiKey, maxRetries: 0 }));
  }

  /** Whether any key is configured (keys may still be resting). */
  get configured(): boolean {
    return this.states.length > 0;
  }

  private month(): string {
    return new Date(this.now()).toISOString().slice(0, 7);
  }

  /** Spend per key this month, or null when it can't be read (fail closed). */
  private async monthSpend(): Promise<Record<string, number> | null> {
    if (this.monthlyCapUsd <= 0) return {};
    const month = this.month();
    if (month === this.spendMonth && this.now() < this.spendExpiry) return this.spend;
    if (this.now() < this.spendFailUntil) return null;
    try {
      this.spend = await this.store.spendByKey(month);
      this.spendMonth = month;
      this.spendExpiry = this.now() + 60_000;
      return this.spend;
    } catch (error: any) {
      this.spendFailUntil = this.now() + 60_000;
      console.warn("[ClaudeCredits] usage read failed, AI paused for 60 s:", error?.message || error);
      return null;
    }
  }

  private rest(state: KeyState, ms: number, reason: string): void {
    const wasResting = state.restUntil > this.now();
    state.restUntil = this.now() + ms;
    state.restReason = reason;
    if (!wasResting) console.warn(`[ClaudeCredits] key ${state.key.label} resting ${Math.round(ms / 60_000)} min: ${reason}`);
  }

  private candidates(spend: Record<string, number>): KeyState[] {
    const n = this.states.length;
    const out: KeyState[] = [];
    for (let i = 0; i < n; i++) {
      const s = this.states[(this.cursor + i) % n];
      if (s.restUntil > this.now()) continue;
      if (this.monthlyCapUsd > 0 && (spend[s.key.label] || 0) >= this.monthlyCapUsd) continue;
      out.push(s);
    }
    this.cursor = (this.cursor + 1) % Math.max(1, n);
    return out;
  }

  /**
   * One structured-output call on the first key that can take it. Throws
   * ClaudeCallError when no answer comes back.
   */
  async generateJson<T>(req: ClaudeJsonRequest): Promise<ClaudeJsonResult<T>> {
    if (!this.configured) throw new ClaudeCallError("unconfigured");
    const spend = await this.monthSpend();
    if (!spend) throw new ClaudeCallError("unavailable", "usage store unreadable");

    for (const state of this.candidates(spend)) {
      let response: any;
      try {
        state.client ??= this.makeClient(state.key.apiKey);
        response = await state.client.beta.messages.create(buildClaudeParams(req) as any, req.timeoutMs ? { timeout: req.timeoutMs } : undefined);
      } catch (error: any) {
        const kind = classifyClaudeError(error);
        if (kind === "credits") {
          const until = regainAccessAt(error);
          if (until && until > this.now()) this.rest(state, until - this.now(), `usage limit until ${new Date(until).toISOString()}`);
          else this.rest(state, this.exhaustedRetryMs, "out of credits");
          continue;
        }
        if (kind === "auth") {
          this.rest(state, 60 * 60_000, `rejected (${error?.status})`);
          continue;
        }
        if (kind === "rate") {
          this.rest(state, retryAfterMs(error) ?? 60_000, "rate limited");
          continue;
        }
        console.warn(`[ClaudeCredits] ${req.feature} failed on ${state.key.label} (${kind}):`, String(error?.message || error).slice(0, 300));
        throw new ClaudeCallError("error", String(error?.message || error).slice(0, 200));
      }

      const usage = sumUsage(response.usage);
      const model: string = response.model || req.model;
      const costUsd = estimateClaudeCost(model, usage.inputTokens, usage.outputTokens);
      // Billed whatever came back: record before any early exit.
      this.spend[state.key.label] = (this.spend[state.key.label] || 0) + costUsd;
      this.store
        .record({ month: this.month(), key: state.key.label, feature: req.feature, model, ...usage, costUsd })
        .catch((error: any) => console.warn("[ClaudeCredits] usage write failed:", error?.message || error));

      if (response.stop_reason === "refusal") throw new ClaudeCallError("refused");
      if (response.stop_reason === "max_tokens") throw new ClaudeCallError("truncated");
      const text = (response.content || [])
        .filter((b: any) => b?.type === "text")
        .map((b: any) => b.text)
        .join("")
        .trim();
      try {
        return { data: JSON.parse(text) as T, model, key: state.key.label, ...usage, costUsd };
      } catch {
        throw new ClaudeCallError("invalid", "answer was not JSON");
      }
    }
    throw new ClaudeCallError("unavailable", "no key available");
  }
}

let shared: ClaudeCredits | null = null;

/** The process-wide pool (created on first use, after env is loaded). */
export function claudeCredits(): ClaudeCredits {
  shared ??= new ClaudeCredits();
  return shared;
}
