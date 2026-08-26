import { PrimaryButton } from "@/components/ui/field";

export function CalculateButton({ onCalculate }: { onCalculate: () => void }) {
  return (
    <PrimaryButton onClick={onCalculate} className="w-full">
      Calculate
    </PrimaryButton>
  );
}
