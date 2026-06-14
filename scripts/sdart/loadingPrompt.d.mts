// Type declarations for the pure JS prompt-assembly module (consumed by the
// generator script and by tests/loadingPrompt.test.ts under tsc --noEmit).
export function essence(descriptor: string): string;
export function buildLoadingPrompt(input: { heroes: string[]; boss: string }): {
  prompt: string;
  negative: string;
};
