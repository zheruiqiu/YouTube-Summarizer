'use client';

import { useEffect, useState } from 'react';
import { Bot, Cpu, CheckCircle2, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ModelAvailability {
  gemini: boolean;
  groq: boolean;
  gpt4: boolean;
  deepseek: boolean;
}

const MODEL_NAMES = {
  deepseek: "DeepSeek",
  gemini: "Google Gemini",
  groq: "Groq",
  gpt4: "GPT-4"
};

const MODEL_DESCRIPTIONS = {
  deepseek: "DeepSeek-R1: Advanced reasoning model with 64K context window",
  gemini: "Fast and cost-effective, good for general summaries",
  groq: "Very fast, good for long videos",
  gpt4: "High-quality summaries, slightly slower"
};

const MODEL_ICONS = {
  deepseek: Bot,
  gemini: Bot,
  groq: Cpu,
  gpt4: Bot
};

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
}

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const [modelAvailability, setModelAvailability] = useState<ModelAvailability | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Set mounted state immediately
    setMounted(true);

    async function fetchModelAvailability() {
      try {
        const response = await fetch('/api/summarize');
        const data = await response.json();
        setModelAvailability(data);
      } catch (error) {
        console.error('Failed to fetch model availability:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchModelAvailability();
  }, []);

  // Show loading state when data is being fetched
  if (isLoading && mounted) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Loading models..." />
        </SelectTrigger>
      </Select>
    );
  }

  // Show static placeholder during initial render (before hydration)
  if (!mounted) {
    return (
      <div className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm">
        {MODEL_NAMES[selectedModel as keyof typeof MODEL_NAMES]}
      </div>
    );
  }

  return (
    <Select value={selectedModel} onValueChange={onModelChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select AI Model" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(MODEL_NAMES).map(([key, name]) => {
          const isAvailable = modelAvailability?.[key as keyof ModelAvailability];
          const Icon = MODEL_ICONS[key as keyof typeof MODEL_ICONS];

          return (
            <SelectItem
              key={key}
              value={key}
              disabled={!isAvailable}
            >
              <div className="flex items-center space-x-2">
                <Icon className="h-4 w-4" />
                <div>
                  <div className="flex items-center space-x-2">
                    <span>{name}</span>
                    {isAvailable ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {MODEL_DESCRIPTIONS[key as keyof typeof MODEL_DESCRIPTIONS]}
                    {!isAvailable && (
                      <span className="text-red-500 block">
                        API key required
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}