"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AVAILABLE_LANGUAGES } from "@/lib/youtube"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Youtube, Clock, Headphones, Trash2 } from "lucide-react"
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
  createdAt: Date
  updatedAt: Date
  mode: string
  source: string | null
}

export default function HistoryPage() {
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const fetchSummaries = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/history')
      if (!response.ok) {
        throw new Error('Failed to fetch summaries')
      }
      const data = await response.json()
      setSummaries(data.summaries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summaries')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummaries()
  }, [])

  const handleClearHistory = async () => {
    try {
      setIsDeleting(true)

      const response = await fetch('/api/history', {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error("Failed to clear history")
      }

      // Refresh the list
      await fetchSummaries()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear history")
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(undefined, {
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

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Summary History</h1>
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="py-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3 w-3" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3 w-3" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3 w-3" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1/3 text-right">Loading History</div>
                  <div className="flex-1">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary w-[45%] rounded-full animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent>
            <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md">{error}</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Summary History</h1>
        {summaries.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isDeleting} className="flex items-center">
                {isDeleting ? (
                  <>
                    <span className="mr-2">Clearing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear History
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all summaries from your history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Clear All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      <div className="space-y-4">
        {summaries.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-center py-8 text-muted-foreground">No summaries yet. Try summarizing some videos!</p>
            </CardContent>
          </Card>
        ) : (
          summaries.map((summary) => (
            <Link href={`/history/${summary.id}`} key={summary.id}>
              <Card className="hover:bg-accent transition-colors">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold line-clamp-1">{summary.title}</h2>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Youtube className="h-4 w-4 mr-1" />
                        <span className="truncate">{summary.videoId}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="flex items-center gap-1">
                        {summary.mode === "podcast" ? <Headphones className="h-3 w-3" /> : <Youtube className="h-3 w-3" />}
                        {summary.mode === "podcast" ? "Podcast" : "Video"}
                      </Badge>
                      <Badge variant="outline">{getLanguageDisplay(summary.language)}</Badge>
                      <div className="flex items-center text-sm text-muted-foreground whitespace-nowrap">
                        <Clock className="h-4 w-4 mr-1" />
                        <time>{formatDate(summary.createdAt)}</time>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

