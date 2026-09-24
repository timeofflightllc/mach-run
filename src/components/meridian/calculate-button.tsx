import { PrimaryButton } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function CalculateButton({
  onCalculate,
  className,
  label = "Calculate",
}: {
  onCalculate: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <PrimaryButton onClick={onCalculate} className={cn("w-full", className)}>
      {label}
    </PrimaryButton>
  );
}