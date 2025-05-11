'use client';

/**
 * Original work Copyright (c) 2025 Enrico Carteciano
 * Modified work Copyright (c) 2025 Zherui Qiu
 *
 * This file is part of YouTube AI Summarizer.
 *
 * YouTube AI Summarizer is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 */

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

    // Separate the API call from the mounted state setting
    let isMounted = true; // For cleanup

    async function fetchModelAvailability() {
      try {
        const response = await fetch('/api/summarize');
        const data = await response.json();
        // Only update state if component is still mounted
        if (isMounted) {
          setModelAvailability(data);
        }
      } catch (error) {
        console.error('Failed to fetch model availability:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchModelAvailability();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []);

  // During server-side rendering or before hydration, show a non-interactive element
  if (!mounted) {
    return (
      <div className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs">
        {MODEL_NAMES[selectedModel as keyof typeof MODEL_NAMES]}
      </div>
    );
  }

  // After hydration, show a proper Select component, even if still loading
  if (isLoading) {
    return (
      <Select value={selectedModel} disabled>
        <SelectTrigger>
          <SelectValue>
            {MODEL_NAMES[selectedModel as keyof typeof MODEL_NAMES]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={selectedModel}>
            Loading models...
          </SelectItem>
        </SelectContent>
      </Select>
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