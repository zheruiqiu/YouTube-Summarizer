/**
 * Extracts the YouTube video ID from various URL formats.
 * Handles standard URLs, URLs with time parameters (e.g., &t=16s),
 * shortened URLs (youtu.be), embed URLs, and shorts URLs.
 *
 * @param youtube_url The YouTube URL to extract the video ID from
 * @returns The extracted video ID
 * @throws Error if the video ID cannot be extracted
 */
export function extractVideoId(youtube_url: string): string {
  // First, try to extract video ID using URL object for standard URLs
  try {
    const url = new URL(youtube_url.trim());

    // Handle standard youtube.com URLs
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      // For standard watch URLs: youtube.com/watch?v=VIDEO_ID
      if (url.pathname.includes('/watch')) {
        const videoId = url.searchParams.get('v');
        if (videoId && videoId.length === 11) {
          return videoId;
        }
      }

      // For shortened URLs: youtu.be/VIDEO_ID
      if (url.hostname === 'youtu.be') {
        const videoId = url.pathname.substring(1); // Remove leading slash
        if (videoId && videoId.length === 11) {
          return videoId;
        }
      }

      // For embed URLs: youtube.com/embed/VIDEO_ID
      if (url.pathname.includes('/embed/')) {
        const parts = url.pathname.split('/');
        const videoId = parts[parts.length - 1];
        if (videoId && videoId.length === 11) {
          return videoId;
        }
      }

      // For shorts URLs: youtube.com/shorts/VIDEO_ID
      if (url.pathname.includes('/shorts/')) {
        const parts = url.pathname.split('/');
        const videoId = parts[parts.length - 1];
        if (videoId && videoId.length === 11) {
          return videoId;
        }
      }
    }
  } catch (e) {
    // If URL parsing fails, fall back to regex patterns
    console.log("URL parsing failed, falling back to regex patterns");
  }

  // Fall back to regex patterns for cases where URL parsing fails
  const patterns = [
    /(?:v=)([0-9A-Za-z_-]{11})(?:&|$)/,     // Standard URLs with query params
    /(?:embed\/)([0-9A-Za-z_-]{11})/,       // Embed URLs
    /(?:youtu\.be\/)([0-9A-Za-z_-]{11})/,   // Shortened URLs
    /(?:shorts\/)([0-9A-Za-z_-]{11})/,      // YouTube Shorts
    /^([0-9A-Za-z_-]{11})$/                 // Just the video ID
  ];

  const url = youtube_url.trim();

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  throw new Error("Could not extract video ID from URL");
}

export const AVAILABLE_LANGUAGES = {
  'English': 'en',
  '中文': 'zh'
} as const;

export function createSummaryPrompt(text: string, targetLanguage: string, mode: 'video' | 'podcast' = 'video') {
  const languagePrompts = {
    'en': {
      title: 'TITLE',
      overview: 'OVERVIEW',
      keyPoints: 'KEY POINTS',
      takeaways: 'MAIN TAKEAWAYS',
      context: 'CONTEXT & IMPLICATIONS',
      details: 'DETAILS'
    },
    'zh': {
      title: '标题',
      overview: '概述',
      keyPoints: '要点',
      takeaways: '主要收获',
      context: '背景与影响',
      details: '详细内容'
    }
  };

  const prompts = languagePrompts[targetLanguage as keyof typeof languagePrompts] || languagePrompts.zh;

  if (mode === 'podcast') {
    return `Please provide a detailed podcast-style summary of the following content in ${targetLanguage}.
    Structure your response EXACTLY as follows, keeping all emojis and section headers intact:

    🎙️ ${prompts.title}: Create an engaging title

    🎧 ${prompts.overview} (3-5 sentences):
    - Provide a detailed context and main purpose

    🔍 ${prompts.keyPoints}:
    - Deep dive into the main arguments
    - Include specific examples and anecdotes
    - Highlight unique perspectives and expert opinions

    📈 ${prompts.takeaways}:
    - List 5-7 practical insights
    - Explain their significance and potential impact

    🌐 ${prompts.context}:
    - Broader context discussion
    - Future implications and expert predictions

    📊 ${prompts.details}:
    - Provide a comprehensive analysis of the content
    - Explain complex concepts in depth
    - Include relevant data and statistics
    - Discuss methodologies or approaches mentioned

    Text to summarize: ${text}

    IMPORTANT:
    1. Keep ALL emojis (🎙️, 🎧, 🔍, 📈, 🌐, 📊) at the beginning of each section
    2. Maintain the exact format structure with section headers
    3. Do not add any prefixes or meta-commentary
    4. If writing in Chinese, ensure proper formatting with emojis followed by Chinese section headers
    5. Ensure the summary is comprehensive enough for someone who hasn't seen the original content`;
  }

  return `Please provide a detailed summary of the following content in ${targetLanguage}.
  Structure your response EXACTLY as follows, keeping all emojis and section headers intact:

  🎯 ${prompts.title}: Create a descriptive title

  📝 ${prompts.overview} (2-3 sentences):
  - Provide a brief context and main purpose

  🔑 ${prompts.keyPoints}:
  - Extract and explain the main arguments
  - Include specific examples
  - Highlight unique perspectives

  💡 ${prompts.takeaways}:
  - List 3-5 practical insights
  - Explain their significance

  🔄 ${prompts.context}:
  - Broader context discussion
  - Future implications

  📋 ${prompts.details}:
  - Provide a more comprehensive analysis
  - Explain important concepts thoroughly
  - Include supporting evidence and data
  - Discuss any methodologies or approaches

  Text to summarize: ${text}

  IMPORTANT:
  1. Keep ALL emojis (🎯, 📝, 🔑, 💡, 🔄, 📋) at the beginning of each section
  2. Maintain the exact format structure with section headers
  3. Do not add any prefixes or meta-commentary
  4. If writing in Chinese, ensure proper formatting with emojis followed by Chinese section headers
  5. Ensure the summary is comprehensive enough for someone who hasn't seen the original content`;
}