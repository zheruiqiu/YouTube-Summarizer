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

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Youtube, Headphones, FileText, Link as LinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AVAILABLE_LANGUAGES, extractVideoId } from "@/lib/youtube"
import { ModelSelector } from "@/components/ModelSelector"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Import model names for the fallback display
const MODEL_NAMES = {
  deepseek: "DeepSeek",
  gemini: "Google Gemini",
  groq: "Groq",
  gpt4: "GPT-4"
}

export default function Home() {
  const [url, setUrl] = useState("")
  const [language, setLanguage] = useState("中文")
  const [mode, setMode] = useState<"video" | "podcast">("video")
  const [aiModel, setAiModel] = useState<"deepseek" | "gemini" | "groq" | "gpt4">("deepseek")
  const [mounted, setMounted] = useState(false)
  const [inputType, setInputType] = useState<"url" | "srt">("url")
  const [srtFile, setSrtFile] = useState<File | null>(null)
  const [srtFileName, setSrtFileName] = useState<string>("")
  const [youtubeId, setYoutubeId] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // This effect ensures components are properly mounted before being interactive
  useEffect(() => {
    // Set mounted state immediately without requestAnimationFrame delay
    setMounted(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (inputType === "url") {
      try {
        const videoId = extractVideoId(url)
        const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`
        const encodedUrl = btoa(cleanUrl).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
        const summaryUrl = `/summary/${encodedUrl}?lang=${AVAILABLE_LANGUAGES[language as keyof typeof AVAILABLE_LANGUAGES]}&mode=${mode}&model=${aiModel}`
        router.push(summaryUrl)
      } catch (error) {
        alert("Invalid YouTube URL. Please enter a valid YouTube URL.")
      }
    } else if (inputType === "srt" && srtFile) {
      // Validate YouTube ID
      if (!youtubeId || youtubeId.length !== 11) {
        alert("Please enter a valid YouTube video ID (11 characters)");
        return;
      }

      // Create a FormData object to send the file
      const formData = new FormData()
      formData.append("srtFile", srtFile)
      formData.append("language", AVAILABLE_LANGUAGES[language as keyof typeof AVAILABLE_LANGUAGES])
      formData.append("mode", mode)
      formData.append("aiModel", aiModel)
      formData.append("fileName", srtFileName)
      formData.append("youtubeId", youtubeId)

      try {
        // Upload the SRT file first
        const uploadResponse = await fetch("/api/upload-srt", {
          method: "POST",
          body: formData,
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error(errorData.error || "Failed to upload SRT file")
        }

        const { id } = await uploadResponse.json()

        if (!id) {
          throw new Error("No ID returned from server after uploading SRT file")
        }

        // Navigate to the summary page with the SRT ID
        // We're using encodeURIComponent to safely include the SRT ID in the URL
        const summaryUrl = `/summary/${encodeURIComponent(id)}?lang=${AVAILABLE_LANGUAGES[language as keyof typeof AVAILABLE_LANGUAGES]}&mode=${mode}&model=${aiModel}&source=srt`
        router.push(summaryUrl)
      } catch (error) {
        alert(`Error uploading SRT file: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    } else {
      alert("Please select an SRT file to upload.")
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.name.toLowerCase().endsWith('.srt')) {
        setSrtFile(file)
        setSrtFileName(file.name)
      } else {
        alert("Please select a valid SRT file (with .srt extension)")
        e.target.value = ""
        setSrtFile(null)
        setSrtFileName("")
      }
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">YouTube AI Summarizer</CardTitle>
          <CardDescription className="text-center">Enter a YouTube URL or upload an SRT file to get an AI-generated summary</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs defaultValue="url" onValueChange={(value) => setInputType(value as "url" | "srt")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url" className="flex items-center">
                  <LinkIcon className="mr-2 h-4 w-4" />
                  YouTube URL
                </TabsTrigger>
                <TabsTrigger value="srt" className="flex items-center">
                  <FileText className="mr-2 h-4 w-4" />
                  SRT File
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value.replace(/^@/, ""))}
                    placeholder="https://youtube.com/watch?v=..."
                    required={inputType === "url"}
                  />
                </div>
              </TabsContent>

              <TabsContent value="srt" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".srt"
                    onChange={handleFileChange}
                    required={inputType === "srt"}
                    className="cursor-pointer"
                  />
                  {srtFileName && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Selected file: {srtFileName}
                    </p>
                  )}
                  <div className="mt-3">
                    <label className="text-sm font-medium mb-1 block">
                      YouTube Video ID (11 characters)
                    </label>
                    <Input
                      type="text"
                      value={youtubeId}
                      onChange={(e) => setYoutubeId(e.target.value.trim())}
                      placeholder="dQw4w9WgXcQ"
                      required={inputType === "srt"}
                      pattern="[a-zA-Z0-9_-]{11}"
                      title="Please enter a valid YouTube video ID (11 characters)"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter the YouTube video ID that corresponds to this SRT file
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-2 gap-4">
              {!mounted ? (
                <>
                  <div className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs">
                    {language}
                  </div>
                  <div className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs">
                    {mode === "video" ? "Video Summary" : "Podcast Style"}
                  </div>
                </>
              ) : (
                <>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue>
                        {language}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(AVAILABLE_LANGUAGES).map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {lang}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={mode} onValueChange={(value) => setMode(value as "video" | "podcast")}>
                    <SelectTrigger>
                      <SelectValue>
                        {mode === "video" ? "Video Summary" : "Podcast Style"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">
                        <div className="flex items-center">
                          <Youtube className="mr-2 h-4 w-4" />
                          <span>Video Summary</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="podcast">
                        <div className="flex items-center">
                          <Headphones className="mr-2 h-4 w-4" />
                          <span>Podcast Style</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>

            {!mounted ? (
              <div className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs">
                {MODEL_NAMES[aiModel as keyof typeof MODEL_NAMES]}
              </div>
            ) : (
              <ModelSelector
                selectedModel={aiModel}
                onModelChange={(model) => setAiModel(model as "deepseek" | "gemini" | "groq" | "gpt4")}
              />
            )}

            <Button type="submit" className="w-full">
              Generate Summary
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

