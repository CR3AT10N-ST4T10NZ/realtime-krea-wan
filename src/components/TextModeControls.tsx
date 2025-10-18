import { Button } from "@/components/ui/button";
import { Dices } from "lucide-react";

type TextModeControlsProps = {
  prompt: string;
  onPromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSurpriseMe: () => void;
  isGenerating: boolean;
};

export function TextModeControls({
  prompt,
  onPromptChange,
  onSurpriseMe,
  isGenerating,
}: TextModeControlsProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-medium text-text-muted font-mono">
          PROMPT
          {isGenerating && (
            <span className="ml-2 text-green-400">(LIVE UPDATES)</span>
          )}
        </label>
        <Button
          onClick={onSurpriseMe}
          variant="default"
          size="sm"
          className="text-xs font-mono"
        >
          <Dices className="w-3 h-3 mr-1" />
          SURPRISE ME
        </Button>
      </div>
      <textarea
        value={prompt}
        onChange={onPromptChange}
        className="w-full px-3 py-2.5 bg-surface-primary rounded-none border border-border-default focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/30 transition resize-none text-sm font-mono text-text-primary disabled:opacity-50"
        rows={3}
        placeholder="Describe what you want to generate..."
      />
      <p className="text-xs text-text-muted mt-1 font-mono">
        Changes update in real-time while generating
      </p>
    </div>
  );
}
