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

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AVAILABLE_LANGUAGES } from "@/lib/youtube"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Youtube, Clock, Globe, Trash2, AlertCircle } from "lucide-react"
import { use } from "react"
import ReactMarkdown from 'react-markdown'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface Summary {
  id: string
  videoId: string
  title: string
  content: string
  language: string
  createdAt: string
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function HistoryDetailPage({ params }: PageProps) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const { id } = use(params)

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/history/${id}`)
        if (!response.ok) {
          throw new Error("Failed to fetch summary")
        }
        const data = await response.json()
        setSummary(data.summary)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load summary")
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [id])

  const handleDelete = async () => {
    try {
      setIsDeleting(true)

      const response = await fetch(`/api/history/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error("Failed to delete summary")
      }

      // Redirect to history page after successful deletion
      router.push('/history')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete summary")
      setIsDeleting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getLanguageDisplay = (code: string) => {
    const entry = Object.entries(AVAILABLE_LANGUAGES).find(([_, langCode]) => langCode === code)
    return entry ? entry[0] : code
  }

  const formatContent = (content: string) => {
    // Split content into sections based on headers
    const sections = content.split(/(<h[1-6].*?<\/h[1-6]>)/)

    return sections.map((section, index) => {
      if (section.startsWith("<h")) {
        // It's a header, wrap it in a div with margin
        return (
          <div key={index} className="mt-6 mb-3 first:mt-0">
            <div dangerouslySetInnerHTML={{ __html: section }} />
          </div>
        )
      } else {
        // It's a content section, split into paragraphs
        const paragraphs = section.split("\n").filter((p) => p.trim() !== "")
        return (
          <div key={index} className="space-y-4">
            {paragraphs.map((paragraph, pIndex) => (
              <p key={pIndex} className="text-gray-700 dark:text-gray-300">
                {paragraph}
              </p>
            ))}
          </div>
        )
      }
    })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    )
  }

  if (error || !summary) {
    return (
      <Card>
        <CardContent>
          <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md">{error || "Summary not found"}</div>
        </CardContent>
      </Card>
    )
  }

  const videoUrl = `https://www.youtube.com/watch?v=${summary.videoId}`

  return (
    <Card>
      <CardHeader>
        <Button variant="ghost" onClick={() => router.push("/history")} className="mb-4 p-0 h-auto font-normal">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to History
        </Button>
        <CardTitle className="text-3xl font-bold">{summary.title}</CardTitle>
        <CardDescription>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant="secondary" className="flex items-center">
              <Globe className="mr-1 h-3 w-3" />
              {getLanguageDisplay(summary.language)}
            </Badge>
            <Badge variant="outline" className="flex items-center">
              <Clock className="mr-1 h-3 w-3" />
              {formatDate(summary.createdAt)}
            </Badge>
            <Button variant="outline" size="sm" asChild>
              <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center">
                <Youtube className="mr-1 h-3 w-3" />
                Watch on YouTube
              </a>
            </Button>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
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
            {summary.content}
          </ReactMarkdown>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end pt-4 border-t">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isDeleting} className="flex items-center">
              {isDeleting ? (
                <>
                  <span className="mr-2">Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Summary
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this summary from your history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  )
}

