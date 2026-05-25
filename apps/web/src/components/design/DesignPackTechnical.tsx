"use client";

export function DesignPackTechnical({
  prompt,
  sketchPrompt,
  latencyMs,
}: {
  prompt: string;
  sketchPrompt: string;
  latencyMs: number;
}) {
  return (
    <details className="analysis-research ds-pack-research">
      <summary className="analysis-research-summary">Technical detail</summary>
      <div className="analysis-research-body">
        <p className="analysis-research-note">
          Demo render placeholder. Latency shown is mock assembly time for this UI build.
        </p>
        <dl className="ds-tech-meta">
          <div>
            <dt>Total latency</dt>
            <dd>{latencyMs} ms</dd>
          </div>
          <div>
            <dt>Render mode</dt>
            <dd>Curated static pack</dd>
          </div>
        </dl>
        <div className="ds-tech-prompt">
          <p className="ds-tech-prompt-label">Studio render prompt</p>
          <pre>{prompt}</pre>
        </div>
        <div className="ds-tech-prompt">
          <p className="ds-tech-prompt-label">Concept sketch prompt</p>
          <pre>{sketchPrompt}</pre>
        </div>
      </div>
    </details>
  );
}
