"use client"

/**
 * Original work Copyright (c) 2025 Enrico Carteciano
 * Modified work Copyright (c) 2025 Zherui Qiu
 *
 * This file is part of YouTube AI Summarizer.
 *
 * YouTube AI Summarizer is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 */

import { useEffect, useState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { AVAILABLE_LANGUAGES } from "@/lib/youtube"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Youtube, Headphones, Subtitles, Bot, Archive, FileText } from "lucide-react"
import { use } from "react"
import ReactMarkdown from 'react-markdown'

interface ProcessingStatus {
  currentChunk: number;
  totalChunks: number;
  stage: 'analyzing' | 'processing' | 'finalizing' | 'saving';
  message: string;
}

function urlSafeBase64Decode(str: string): string {
  try {
    // If the string already contains colons, it might be an unencoded SRT ID
    if (str.includes(':')) {
      return str
    }

    const base64 = str.replace(/-/g, "+").replace(/_/g, "/")
    const pad = base64.length % 4
    const paddedBase64 = pad ? base64 + "=".repeat(4 - pad) : base64
    return atob(paddedBase64)
  } catch (error) {
    console.error("Error in base64 decoding:", error)
    // Return the original string if decoding fails
    return str
  }
}

interface PageProps {
  params: Promise<{ videoUrl: string }>
}

export default function SummaryPage({ params }: PageProps) {
  const [summary, setSummary] = useState<string>("")
  const [source, setSource] = useState<"youtube" | "cache" | "srt" | "whisper" | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<ProcessingStatus>({
    currentChunk: 0,
    totalChunks: 0,
    stage: 'analyzing',
    message: 'Analyzing video content...'
  })

  // Add a ref to track if a request is in progress
  const requestInProgressRef = useRef(false)
  // Add a ref to store the mounted state
  const isMountedRef = useRef(false)

  const searchParams = useSearchParams()
  const languageCode = searchParams.get("lang") || "zh"
  const mode = (searchParams.get("mode") || "video") as "video" | "podcast"
  const aiModel = (searchParams.get("model") || "deepseek") as "deepseek" | "gemini" | "groq" | "gpt4"
  const sourceParam = searchParams.get("source") || ""
  const { videoUrl } = use(params)

  // Add a useEffect to set the mounted flag
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const fetchSummary = async () => {
      // Check if a request is already in progress to prevent duplicate calls
      if (requestInProgressRef.current) {
        console.log("[INFO] Skipping duplicate request - a summary request is already in progress")
        return
      }

      // Set the request in progress flag
      requestInProgressRef.current = true

      try {
        setLoading(true)
        setError(null)

        // First try to decode from URL encoding
        let decodedUrl: string;
        try {
          // First try to decode from URL encoding (for SRT files)
          decodedUrl = decodeURIComponent(videoUrl);

          // If it's not an SRT file, try base64 decoding
          if (!decodedUrl.startsWith("srt:")) {
            decodedUrl = urlSafeBase64Decode(videoUrl);
          }
        } catch (error) {
          console.error("Error decoding URL:", error);
          // If decoding fails, use the raw URL
          decodedUrl = videoUrl;
        }

        const isSrtFile = sourceParam === "srt" || decodedUrl.startsWith("srt:");

        console.log(`[INFO] Starting summary request for ${isSrtFile ? 'SRT file' : 'video'}: ${decodedUrl}`)

        // Prepare request body based on source type
        const requestBody: any = {
          language: languageCode,
          mode,
          aiModel
        }

        if (isSrtFile) {
          requestBody.srtId = decodedUrl
        } else {
          requestBody.url = decodedUrl
        }

        const response = await fetch("/api/summarize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to generate summary")
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error("Failed to read response stream")
        }

        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Check if component is still mounted
          if (!isMountedRef.current) {
            console.log("[INFO] Component unmounted during request, aborting")
            break
          }

          const chunk = decoder.decode(value)
          try {
            // Split by newlines to handle multiple JSON objects in a single chunk
            const jsonLines = chunk.split('\n').filter(line => line.trim() !== '')

            for (const jsonLine of jsonLines) {
              try {
                const data = JSON.parse(jsonLine)

                if (data.type === 'progress') {
                  setStatus({
                    currentChunk: data.currentChunk,
                    totalChunks: data.totalChunks,
                    stage: data.stage,
                    message: data.message
                  })
                } else if (data.type === 'complete') {
                  setSummary(data.summary)
                  setSource(data.source)
                  console.log("[INFO] Summary request completed successfully")
                  break
                } else if (data.type === 'error') {
                  throw new Error(data.error)
                }
              } catch (jsonError) {
                console.error('Error parsing JSON line:', jsonError, jsonLine)
              }
            }
          } catch (e) {
            console.error('Error processing chunk:', e)
          }
        }
      } catch (err) {
        console.error("Error fetching summary:", err)
        setError(err instanceof Error ? err.message : "An error occurred while generating the summary")
      } finally {
        // Reset the request in progress flag
        requestInProgressRef.current = false

        // Only update loading state if component is still mounted
        if (isMountedRef.current) {
          setLoading(false)
        }
      }
    }

    // Only fetch if we have the required parameters
    if (videoUrl && languageCode && mode && aiModel) {
      fetchSummary()
    }
  }, [videoUrl, languageCode, mode, aiModel])

  const displayLanguage =
    Object.entries(AVAILABLE_LANGUAGES).find(([_, code]) => code === languageCode)?.[0] || "中文"

  const getSourceIcon = () => {
    switch (source) {
      case "youtube":
        return <Subtitles className="h-4 w-4" />
      case "srt":
        return <FileText className="h-4 w-4" />
      case "whisper":
        return <Bot className="h-4 w-4" />
      case "cache":
        return <Archive className="h-4 w-4" />
      default:
        return null
    }
  }

  const getSourceDisplay = () => {
    switch (source) {
      case "youtube":
        return "YouTube subtitles"
      case "srt":
        return "SRT file"
      case "whisper":
        return "Audio transcription"
      case "cache":
        return "Cached summary"
      default:
        return ""
    }
  }

  if (loading) {
    const progress = status.totalChunks ? (status.currentChunk / status.totalChunks) * 100 : 0

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Generating Summary</CardTitle>
            <CardDescription>Please wait while we process your video</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{status.message}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${status.stage === 'analyzing' ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
                  <span className={status.stage === 'analyzing' ? 'text-primary' : 'text-muted-foreground'}>
                    Analyzing video content
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${status.stage === 'processing' ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
                  <span className={status.stage === 'processing' ? 'text-primary' : 'text-muted-foreground'}>
                    Processing chunks ({status.currentChunk}/{status.totalChunks})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${status.stage === 'finalizing' ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
                  <span className={status.stage === 'finalizing' ? 'text-primary' : 'text-muted-foreground'}>
                    Creating final summary
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${status.stage === 'saving' ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
                  <span className={status.stage === 'saving' ? 'text-primary' : 'text-muted-foreground'}>
                    Saving to history
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span className="text-2xl font-bold flex items-center">
              {mode === "podcast" ? <Headphones className="mr-2" /> : <Youtube className="mr-2" />}
              {mode === "podcast" ? "Podcast-Style Summary" : "Video Summary"}
            </span>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">{displayLanguage}</Badge>
              {source && (
                <Badge variant="outline" className="flex items-center">
                  {getSourceIcon()}
                  <span className="ml-1">{getSourceDisplay()}</span>
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md mb-4">
              <h3 className="font-semibold mb-1">Error</h3>
              <p>{error}</p>
              {error.includes('DeepSeek API error') && (
                <div className="mt-2 text-sm">
                  <p className="font-medium">Possible solutions:</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    {error.includes('Authentication failed') && (
                      <li>Check that your DeepSeek API key is valid and correctly configured in the .env file</li>
                    )}
                    {error.includes('Insufficient balance') && (
                      <li>Top up your DeepSeek account or switch to a different AI model</li>
                    )}
                    {error.includes('Rate limit') && (
                      <li>Wait a few minutes before trying again or switch to a different AI model</li>
                    )}
                    {(error.includes('server error') || error.includes('server overloaded')) && (
                      <li>Try again later when the DeepSeek service is less busy or switch to a different AI model</li>
                    )}
                    <li>Try selecting a different AI model from the homepage</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {!loading && !error && (
            <div className="prose prose-sm sm:prose lg:prose-lg max-w-none dark:prose-invert">
              <ReactMarkdown
                components={{
                  // Ensure emojis are rendered properly
                  p: ({node, ...props}) => {
                    const content = props.children?.toString() || '';
                    // Check if paragraph starts with emoji
                    if (content.match(/^\s*[🎯🎙️📝🔑📋💡🔄🎧🔍📊📈🌐]/)) {
                      return <p className="font-bold text-lg" {...props} />;
                    }
                    return <p {...props} />;
                  },
                  // Enhance headers that might be used in the summary
                  h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-6" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-5" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-lg font-bold mt-4" {...props} />,
                }}
              >
                {summary}
              </ReactMarkdown>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

