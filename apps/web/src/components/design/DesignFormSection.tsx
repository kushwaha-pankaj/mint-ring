export function DesignFormSection({
  num,
  label,
  children,
}: {
  num: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ds-form-section" aria-labelledby={`ds-section-${num}`}>
      <h3 id={`ds-section-${num}`} className="ds-form-section-label">
        {num}. {label}
      </h3>
      {children}
    </section>
  );
}
