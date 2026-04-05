let activeWebGlContexts = 0;

// Keep a conservative cap to avoid browser-level context eviction cascades.
const MAX_ACTIVE_WEBGL_CONTEXTS = 3;

export function tryAcquireWebGlContext(): boolean {
  if (activeWebGlContexts >= MAX_ACTIVE_WEBGL_CONTEXTS) {
    return false;
  }

  activeWebGlContexts += 1;
  return true;
}

export function releaseWebGlContext(): void {
  if (activeWebGlContexts > 0) {
    activeWebGlContexts -= 1;
  }
}

export function getActiveWebGlContextCount(): number {
  return activeWebGlContexts;
}
