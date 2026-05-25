/** Wait until Google's <model-viewer> custom element is registered. */
export function whenModelViewerReady(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (customElements.get("model-viewer")) {
    return Promise.resolve();
  }
  return customElements.whenDefined("model-viewer").then(() => undefined);
}
