const STEPS = [
  { num: 1, label: "Your ring" },
  { num: 2, label: "Hand photo" },
  { num: 3, label: "Photoreal view" },
] as const;

export function TryOnSteps({ currentStep }: { currentStep: number }) {
  return (
    <nav className="ds-stepper ds-stepper--hero" aria-label="Try-on progress">
      {STEPS.map((step, i) => {
        const done = step.num < currentStep;
        const active = step.num === currentStep;

        return (
          <span key={step.label} className="ds-stepper-item">
            <span
              className={[
                "ds-stepper-step",
                active ? "ds-stepper-step--active" : "",
                done ? "ds-stepper-step--done" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={active ? "step" : undefined}
            >
              <span className="ds-stepper-num" aria-hidden={done}>
                {done ? <CheckIcon /> : step.num}
              </span>
              <span className="ds-stepper-label">{step.label}</span>
            </span>
            {i < STEPS.length - 1 && <span className="ds-stepper-line" aria-hidden />}
          </span>
        );
      })}
    </nav>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2.5 7l3.5 3.5 5.5-7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
