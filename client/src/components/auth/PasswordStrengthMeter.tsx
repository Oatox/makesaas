function getPasswordStrength(password: string) {
  if (password.length < 6) return { score: 1, label: "Trop court", color: "bg-destructive" };

  let score = 1;
  if (password.length > 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 2, label: "Faible", color: "bg-destructive" };
  if (score <= 3) return { score: 3, label: "Moyenne", color: "bg-highlight" };
  if (score <= 4) return { score: 4, label: "Forte", color: "bg-success/70" };
  return { score: 5, label: "Excellente", color: "bg-success" };
}

/**
 * Five-segment strength bar shown under the sign-up password (nothing while the field is empty).
 * One compact line laid over the gap under the field (the parent is `relative`): showing it never
 * changes the form's height, so the page does not grow or start scrolling.
 */
export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const strength = getPasswordStrength(password);

  return (
    <div className="absolute inset-x-0 top-full mt-1.5 flex items-center gap-3">
      <div className="flex h-1 flex-1 gap-1">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`flex-1 rounded-full transition-colors duration-300 ${step <= strength.score ? strength.color : "bg-secondary"}`}
          />
        ))}
      </div>
      <p className="shrink-0 text-[11px] leading-none text-muted-foreground">
        <span className="font-medium text-foreground">{strength.label}</span>
      </p>
    </div>
  );
}
