"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Youtube, Headphones } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AVAILABLE_LANGUAGES, extractVideoId } from "@/lib/youtube"
import { ModelSelector } from "@/components/ModelSelector"

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
  const router = useRouter()

  // This effect ensures components are properly mounted before being interactive
  useEffect(() => {
    // Use requestAnimationFrame to ensure we're in the browser environment
    // and the DOM is fully rendered before setting mounted to true
    requestAnimationFrame(() => {
      setMounted(true)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const videoId = extractVideoId(url)
      const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`
      const encodedUrl = btoa(cleanUrl).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
      const summaryUrl = `/summary/${encodedUrl}?lang=${AVAILABLE_LANGUAGES[language as keyof typeof AVAILABLE_LANGUAGES]}&mode=${mode}&model=${aiModel}`
      router.push(summaryUrl)
    } catch (error) {
      alert("Invalid YouTube URL. Please enter a valid YouTube URL.")
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">YouTube AI Summarizer</CardTitle>
          <CardDescription className="text-center">Enter a YouTube URL to get an AI-generated summary</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value.replace(/^@/, ""))}
                placeholder="https://youtube.com/watch?v=..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {mounted ? (
                <>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Language" />
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
                      <SelectValue placeholder="Select Mode" />
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
              ) : (
                <>
                  <div className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm">
                    {language}
                  </div>
                  <div className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm">
                    {mode === "video" ? "Video Summary" : "Podcast Style"}
                  </div>
                </>
              )}
            </div>

            {mounted ? (
              <ModelSelector
                selectedModel={aiModel}
                onModelChange={(model) => setAiModel(model as "deepseek" | "gemini" | "groq" | "gpt4")}
              />
            ) : (
              <div className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm">
                {MODEL_NAMES[aiModel as keyof typeof MODEL_NAMES]}
              </div>
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

