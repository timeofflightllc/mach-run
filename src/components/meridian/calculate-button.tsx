import { PrimaryButton } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function CalculateButton({
  onCalculate,
  className,
}: {
  onCalculate: () => void;
  className?: string;
}) {
  return (
    <PrimaryButton onClick={onCalculate} className={cn("w-full", className)}>
      Calculate
    </PrimaryButton>
  );
}