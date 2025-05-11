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
import { Youtube, Headphones, FileText, Link as LinkIcon, Upload } from "lucide-react"
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
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // This effect ensures components are properly mounted before being interactive
  useEffect(() => {
    // Set mounted state immediately without requestAnimationFrame delay
    setMounted(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Form submitted. Input type:", inputType)
    console.log("SRT file:", srtFile ? srtFile.name : "none")

    // Force a small delay to ensure state updates have propagated
    await new Promise(resolve => setTimeout(resolve, 100));

    if (inputType === "url") {
      try {
        console.log("Processing URL:", url)
        const videoId = extractVideoId(url)
        const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`
        const encodedUrl = btoa(cleanUrl).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
        const summaryUrl = `/summary/${encodedUrl}?lang=${AVAILABLE_LANGUAGES[language as keyof typeof AVAILABLE_LANGUAGES]}&mode=${mode}&model=${aiModel}`
        console.log("Navigating to:", summaryUrl)
        router.push(summaryUrl)
      } catch (error) {
        console.error("URL processing error:", error)
        alert("Invalid YouTube URL. Please enter a valid YouTube URL.")
      }
    } else if (inputType === "srt") {
      // Check if we have a file, regardless of input type
      if (!srtFile) {
        console.error("No SRT file selected")
        alert("Please select an SRT file to upload.")
        return;
      }

      console.log("Processing SRT file:", srtFile.name)
      // Validate and process YouTube ID or URL
      if (!youtubeId) {
        alert("Please enter a YouTube video ID or URL");
        return;
      }

      let validVideoId: string;

      try {
        // Check if input is a URL or just a video ID
        if (youtubeId.includes('youtube.com') || youtubeId.includes('youtu.be')) {
          // It's a URL, extract the video ID
          validVideoId = extractVideoId(youtubeId);
        } else if (youtubeId.match(/^[a-zA-Z0-9_-]{11}$/)) {
          // It's already a valid 11-character video ID
          validVideoId = youtubeId;
        } else {
          throw new Error("Invalid YouTube video ID format");
        }
      } catch (error) {
        alert("Please enter a valid YouTube video ID or URL");
        return;
      }

      // Create a FormData object to send the file
      const formData = new FormData()
      formData.append("srtFile", srtFile)
      formData.append("language", AVAILABLE_LANGUAGES[language as keyof typeof AVAILABLE_LANGUAGES])
      formData.append("mode", mode)
      formData.append("aiModel", aiModel)
      formData.append("fileName", srtFileName)
      formData.append("youtubeId", validVideoId)

      try {
        console.log("Starting SRT file upload...")
        // Upload the SRT file first
        const uploadResponse = await fetch("/api/upload-srt", {
          method: "POST",
          body: formData,
        })

        console.log("Upload response status:", uploadResponse.status)

        // Parse the response JSON once
        let responseData;
        try {
          responseData = await uploadResponse.json()
          console.log("Response data:", responseData)
        } catch (jsonError) {
          console.error("Error parsing response JSON:", jsonError)
          throw new Error("Failed to parse server response")
        }

        if (!uploadResponse.ok) {
          console.error("Upload failed with status:", uploadResponse.status)
          throw new Error(responseData.error || "Failed to upload SRT file")
        }

        if (!responseData || typeof responseData !== 'object') {
          console.error("Invalid response data:", responseData)
          throw new Error("Invalid response from server")
        }

        const { id } = responseData
        console.log("Extracted ID:", id)

        if (!id) {
          console.error("No ID in response data:", responseData)
          throw new Error("No ID returned from server after uploading SRT file")
        }

        // Navigate to the summary page with the SRT ID
        // We're using encodeURIComponent to safely include the SRT ID in the URL
        const summaryUrl = `/summary/${encodeURIComponent(id)}?lang=${AVAILABLE_LANGUAGES[language as keyof typeof AVAILABLE_LANGUAGES]}&mode=${mode}&model=${aiModel}&source=srt`
        console.log("Navigating to summary URL:", summaryUrl)

        try {
          router.push(summaryUrl)
          console.log("Navigation initiated")
        } catch (navError) {
          console.error("Navigation error:", navError)
          alert(`Error navigating to summary: ${navError instanceof Error ? navError.message : "Unknown error"}`)
        }
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
      processFile(file)
    }
  }

  const processFile = (file: File) => {
    console.log("Processing file:", file.name, "type:", file.type, "size:", file.size)

    if (file.name.toLowerCase().endsWith('.srt')) {
      console.log("Valid SRT file detected")
      setSrtFile(file)
      setSrtFileName(file.name)

      // Ensure we're in SRT mode when a file is dropped
      if (inputType !== "srt") {
        console.log("Switching to SRT input type")
        setInputType("srt")
      }
    } else {
      console.warn("Invalid file type:", file.type)
      alert("Please select a valid SRT file (with .srt extension)")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      setSrtFile(null)
      setSrtFileName("")
    }
  }

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging) {
      setIsDragging(true)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    console.log("File dropped")

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      console.log("Processing dropped file")
      // Ensure we're in SRT mode
      setInputType("srt")
      processFile(files[0])
    }
  }

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
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
          <form onSubmit={(e) => {
            console.log("Form onSubmit triggered");
            handleSubmit(e);
          }} className="space-y-6">
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
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".srt"
                    onChange={handleFileChange}
                    required={inputType === "srt"}
                    className="hidden"
                  />

                  <div
                    ref={dropZoneRef}
                    className={`border-2 border-dashed rounded-md p-6 text-center transition-colors ${
                      isDragging
                        ? 'border-primary bg-primary/5'
                        : 'border-muted-foreground/25 hover:border-primary/50'
                    }`}
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={handleBrowseClick}
                  >
                    <div className="flex flex-col items-center justify-center space-y-2 cursor-pointer">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        {isDragging ? 'Drop your SRT file here' : 'Drag & drop your SRT file here'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        or <span className="text-primary underline">browse files</span>
                      </p>
                      {srtFileName && (
                        <div className="mt-2 p-2 bg-muted rounded-md w-full">
                          <p className="text-sm font-medium truncate">
                            Selected: {srtFileName}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="text-sm font-medium mb-1 block">
                      YouTube Video ID or URL
                    </label>
                    <Input
                      type="text"
                      value={youtubeId}
                      onChange={(e) => setYoutubeId(e.target.value.trim())}
                      placeholder="dQw4w9WgXcQ or https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                      required={inputType === "srt"}
                      title="Please enter a valid YouTube video ID or URL"
                    />
                  </div>

                  {/* We've removed the emergency direct upload button */}
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

            <Button
              type="button"
              className="w-full"
              onClick={async (e) => {
                console.log("Generate Summary button clicked");
                e.preventDefault();

                if (inputType === "url") {
                  // For URL mode, use the original handleSubmit function
                  handleSubmit(e as unknown as React.FormEvent);
                } else if (inputType === "srt" && srtFile) {
                  // For SRT mode with a file, use direct upload approach
                  console.log("Processing SRT file directly:", srtFile.name);

                  if (!youtubeId) {
                    alert("Please enter a YouTube video ID or URL");
                    return;
                  }

                  let validVideoId: string;

                  try {
                    // Check if input is a URL or just a video ID
                    if (youtubeId.includes('youtube.com') || youtubeId.includes('youtu.be')) {
                      // It's a URL, extract the video ID
                      validVideoId = extractVideoId(youtubeId);
                    } else if (youtubeId.match(/^[a-zA-Z0-9_-]{11}$/)) {
                      // It's already a valid 11-character video ID
                      validVideoId = youtubeId;
                    } else {
                      throw new Error("Invalid YouTube video ID format");
                    }
                  } catch (error) {
                    alert("Please enter a valid YouTube video ID or URL");
                    return;
                  }

                  // Create a FormData object to send the file
                  const formData = new FormData();
                  formData.append("srtFile", srtFile);
                  formData.append("language", AVAILABLE_LANGUAGES[language as keyof typeof AVAILABLE_LANGUAGES]);
                  formData.append("mode", mode);
                  formData.append("aiModel", aiModel);
                  formData.append("fileName", srtFileName);
                  formData.append("youtubeId", validVideoId);

                  try {
                    console.log("Starting SRT file upload...");
                    // Upload the SRT file
                    const uploadResponse = await fetch("/api/upload-srt", {
                      method: "POST",
                      body: formData,
                    });

                    console.log("Upload response status:", uploadResponse.status);

                    // Parse the response JSON
                    const responseData = await uploadResponse.json();
                    console.log("Response data:", responseData);

                    if (!uploadResponse.ok) {
                      throw new Error(responseData.error || "Failed to upload SRT file");
                    }

                    const { id } = responseData;

                    if (!id) {
                      throw new Error("No ID returned from server");
                    }

                    // Navigate to the summary page
                    const summaryUrl = `/summary/${encodeURIComponent(id)}?lang=${AVAILABLE_LANGUAGES[language as keyof typeof AVAILABLE_LANGUAGES]}&mode=${mode}&model=${aiModel}&source=srt`;
                    console.log("Navigating to:", summaryUrl);

                    // Use direct navigation for SRT files
                    window.location.href = summaryUrl;
                  } catch (error) {
                    console.error("Error during SRT upload:", error);
                    alert(`Error uploading SRT file: ${error instanceof Error ? error.message : "Unknown error"}`);
                  }
                } else {
                  alert("Please select an SRT file to upload or enter a YouTube URL.");
                }
              }}
            >
              Generate Summary
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

