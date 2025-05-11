/**
 * Original work Copyright (c) 2025 Enrico Carteciano
 * Modified work Copyright (c) 2025 Zherui Qiu
 *
 * This file is part of YouTube AI Summarizer.
 *
 * YouTube AI Summarizer is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 */

import { NextResponse } from "next/server";
import { YoutubeTranscript } from 'youtube-transcript';
import { prisma } from "@/lib/prisma";
import { extractVideoId, createSummaryPrompt } from '@/lib/youtube';
import { srtToText } from '@/lib/srt';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Groq } from "groq-sdk";
import OpenAI from 'openai';
import ytdl from 'ytdl-core';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import FormData from 'form-data';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

// Add at the top of the file after imports
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message: string, error: any) => {
    console.error(`[ERROR] ${message}`, {
      message: error?.message,
      status: error?.status,
      stack: error?.stack,
      cause: error?.cause,
      details: error?.details,
      response: error?.response,
    });
  },
  debug: (message: string, data?: any) => {
    console.debug(`[DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
};

// Initialize API clients only when needed
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI;
}

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function getDeepSeekClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.deepseek.com'
  });
}

// Helper function to get user-friendly model names
const MODEL_NAMES = {
  gemini: "Google Gemini",
  groq: "Groq",
  gpt4: "GPT-4",
  deepseek: "DeepSeek"
};

// Helper function to check API key availability
function checkApiKeyAvailability() {
  return {
    gemini: !!process.env.GEMINI_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
    gpt4: !!process.env.OPENAI_API_KEY,
    deepseek: !!process.env.DEEPSEEK_API_KEY
  };
}

// Helper function to clean model outputs
function cleanModelOutput(text: string): string {
  // First check if the text already has the expected format with emojis
  if (text.match(/🎯|🎙️|📝|🔑|📋|💡|🔄|🎧|🔍|📊|📈|🌐/)) {
    // Text already has the expected format, just do minimal cleaning
    return text
      // Remove only the most common prefixes that might appear before the actual content
      .replace(/^(Here is the summary:|Summary:|以下是摘要：|摘要：)\s*/i, '')
      .trim();
  }

  // If the text doesn't have the expected format, apply more aggressive cleaning
  return text
    // English prefixes
    .replace(/^(Okay|Here'?s?( is)?|Let me|I will|I'll|I can|I would|I am going to|Allow me to|Sure|Of course|Certainly|Alright)[^]*?,\s*/i, '')
    .replace(/^(Here'?s?( is)?|I'?ll?|Let me|I will|I can|I would|I am going to|Allow me to|Sure|Of course|Certainly)[^]*?(summary|translate|breakdown|analysis).*?:\s*/i, '')
    .replace(/^(Based on|According to).*?,\s*/i, '')
    .replace(/^I understand.*?[.!]\s*/i, '')
    .replace(/^(Now|First|Let's),?\s*/i, '')
    .replace(/^(Here are|The following is|This is|Below is).*?:\s*/i, '')
    .replace(/^(I'll provide|Let me break|I'll break|I'll help|I've structured).*?:\s*/i, '')
    .replace(/^(As requested|Following your|In response to).*?:\s*/i, '')
    // Chinese prefixes
    .replace(/^(好的|这是|让我|我将|我会|我能|我想|请允许我|当然|确实|好的)[^]*?,\s*/i, '')
    .replace(/^(这是|我将|让我|我能|我想)[^]*?(摘要|翻译|分析).*?[:：]\s*/i, '')
    .replace(/^(基于|根据|按照).*?[,，]\s*/i, '')
    .replace(/^我理解.*?[.!。！]\s*/i, '')
    .replace(/^(现在|首先|让我们)[,，]?\s*/i, '')
    .replace(/^(以下是|这是|下面是).*?[:：]\s*/i, '')
    .replace(/^(我将提供|让我分析|我将分析|我会帮助|我已经整理)[^]*?[:：]\s*/i, '')
    .replace(/^(根据您的要求|按照您的|作为对)[^]*?[:：]\s*/i, '')
    // Remove meta instructions while preserving markdown
    .replace(/^[^:\n🎯🎙️📋#*\-•]+[:：]\s*/gm, '')  // Remove prefixes but keep markdown and emojis
    .replace(/^(?![#*\-•🎯️])[\s\d]+[.。]\s*/gm, '') // Remove numbered lists but keep markdown lists
    .trim();
}

// AI Model configuration
const AI_MODELS = {
  gemini: {
    name: "gemini",
    async generateContent(prompt: string) {
      const genAI = getGeminiClient();
      if (!genAI) {
        throw new Error(`${MODEL_NAMES.gemini} API key is not configured. Please add your API key in the settings or choose a different model.`);
      }
      // Add instruction to base summary strictly on the provided content
      const enhancedPrompt = `IMPORTANT INSTRUCTION: Base your summary STRICTLY on the provided content - do not include any imagined, fabricated, or speculative information that is not present in the original content.\n\n${prompt}`;
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
      const result = await model.generateContent(enhancedPrompt);
      const response = await result.response;
      return cleanModelOutput(response.text());
    }
  },
  groq: {
    name: "groq",
    model: "llama-3.3-70b-versatile",
    async generateContent(prompt: string) {
      const groq = getGroqClient();
      if (!groq) {
        throw new Error(`${MODEL_NAMES.groq} API key is not configured. Please add your API key in the settings or choose a different model.`);
      }
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a direct and concise summarizer. Respond only with the summary in the requested language, without any prefixes or meta-commentary. Keep all markdown formatting intact. If the language is Chinese, ensure the summary is in fluent, natural Chinese. Base your summary STRICTLY on the provided content - do not include any imagined, fabricated, or speculative information that is not present in the original content."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: this.model,
        temperature: 0.7,
        max_tokens: 2048,
      });
      return cleanModelOutput(completion.choices[0]?.message?.content || '');
    }
  },
  gpt4: {
    name: "gpt4",
    model: "gpt-4o-mini",
    async generateContent(prompt: string) {
      const openai = getOpenAIClient();
      if (!openai) {
        throw new Error(`${MODEL_NAMES.gpt4} API key is not configured. Please add your API key in the settings or choose a different model.`);
      }
      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a direct and concise summarizer. Respond only with the summary in the requested language, without any prefixes or meta-commentary. Keep all markdown formatting intact. If the language is Chinese, ensure the summary is in fluent, natural Chinese. Base your summary STRICTLY on the provided content - do not include any imagined, fabricated, or speculative information that is not present in the original content."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: this.model,
        temperature: 0.7,
        max_tokens: 2048,
      });
      return cleanModelOutput(completion.choices[0]?.message?.content || '');
    }
  },
  deepseek: {
    name: "deepseek",
    model: "deepseek-reasoner", // Using DeepSeek-R1 reasoning model
    async generateContent(prompt: string) {
      const deepseek = getDeepSeekClient();
      if (!deepseek) {
        throw new Error(`${MODEL_NAMES.deepseek} API key is not configured. Please add your API key in the settings or choose a different model.`);
      }

      try {
        const completion = await deepseek.chat.completions.create({
          messages: [
            {
              role: "system",
              content: "You are a comprehensive summarizer with strong reasoning capabilities. Respond only with the summary in the requested language, without any prefixes or meta-commentary. Keep all markdown formatting intact. Follow the exact format structure provided in the prompt, including all emojis and section headers. If the language is Chinese, ensure the summary is in fluent, natural Chinese. Pay special attention to the 'details' section, which should be extensive and thorough (at least 1000-1500 words), providing in-depth analysis, multiple examples, and comprehensive explanations. Take full advantage of your 8K token output capacity to create detailed, nuanced summaries, especially in the details section. Base your summary STRICTLY on the provided content - do not include any imagined, fabricated, or speculative information that is not present in the original content."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          model: this.model,
          max_tokens: 8000, // Maximized token limit for comprehensive summaries (DeepSeek supports up to 8K output tokens)
        });

        // deepseek-reasoner returns both reasoning_content and content
        // We use the final content (answer) for the summary
        return cleanModelOutput(completion.choices[0]?.message?.content || '');
      } catch (error: any) {
        // Handle DeepSeek API specific errors
        const statusCode = error?.status || error?.response?.status;
        let errorMessage = error?.message || 'Unknown error occurred';

        // Map status codes to user-friendly error messages based on DeepSeek documentation
        switch (statusCode) {
          case 400:
            errorMessage = 'Invalid request format: ' + errorMessage;
            break;
          case 401:
            errorMessage = 'Authentication failed: Please check your DeepSeek API key';
            break;
          case 402:
            errorMessage = 'Insufficient balance: Your DeepSeek account has run out of credits. Please top up your account.';
            break;
          case 422:
            errorMessage = 'Invalid parameters in request: ' + errorMessage;
            break;
          case 429:
            errorMessage = 'Rate limit reached: You are sending requests to DeepSeek API too quickly. Please try again later.';
            break;
          case 500:
            errorMessage = 'DeepSeek server error: Please try again later.';
            break;
          case 503:
            errorMessage = 'DeepSeek server overloaded: The service is temporarily unavailable due to high traffic. Please try again later.';
            break;
        }

        logger.error('DeepSeek API error:', {
          statusCode,
          message: errorMessage,
          originalError: error.message,
          stack: error.stack
        });

        throw new Error(`DeepSeek API error: ${errorMessage}`);
      }
    }
  }
};

async function splitTranscriptIntoChunks(transcript: string, chunkSize: number = 150000, overlap: number = 10000): Promise<string[]> {
  const words = transcript.split(' ');
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (const word of words) {
    if (currentLength + word.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      // Keep last few words for overlap (approximately 1000 words for 10000 character overlap)
      const overlapWords = currentChunk.slice(-Math.floor(overlap / 10));
      currentChunk = [...overlapWords];
      currentLength = overlapWords.join(' ').length;
    }
    currentChunk.push(word);
    currentLength += word.length + 1; // +1 for space
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  const totalWords = words.length;
  logger.info(
    `Split transcript details:\n` +
    `- Chunks: ${chunks.length}\n` +
    `- Chunk size: ${chunkSize} characters\n` +
    `- Overlap: ${overlap} characters\n` +
    `- Total word count: ${totalWords}\n` +
    `- Average words per chunk: ${Math.round(totalWords / chunks.length)}`
  );

  return chunks;
}

async function downloadAudio(videoId: string): Promise<string> {
  const tempPath = path.join('/tmp', `${videoId}_temp.mp3`);
  const outputPath = path.join('/tmp', `${videoId}.flac`);

  try {
    logger.info(`Starting audio download for video ${videoId}`);

    // First download the audio
    await new Promise<void>((resolve, reject) => {
      // Ensure we have a clean video ID without any parameters (must be exactly 11 characters)
      const cleanVideoId = videoId.length === 11 ? videoId : extractVideoId(videoId);
      // Create a clean URL with just the video ID, no timestamp or other parameters
      const videoUrl = `https://www.youtube.com/watch?v=${cleanVideoId}`;
      logger.debug(`Downloading from URL: ${videoUrl}`);

      // Get video info first
      ytdl.getInfo(videoUrl).then(info => {
        logger.info('Video info retrieved:', {
          title: info.videoDetails.title,
          duration: info.videoDetails.lengthSeconds
        });

        // Select the best audio format
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        const format = audioFormats.sort((a, b) => {
          // Prefer opus/webm formats
          if (a.codecs?.includes('opus') && !b.codecs?.includes('opus')) return -1;
          if (!a.codecs?.includes('opus') && b.codecs?.includes('opus')) return 1;
          // Then sort by audio quality (bitrate)
          return (b.audioBitrate || 0) - (a.audioBitrate || 0);
        })[0];

        if (!format) {
          reject(new Error('No suitable audio format found'));
          return;
        }

        logger.info('Selected audio format:', {
          container: format.container,
          codec: format.codecs,
          quality: format.quality,
          bitrate: format.audioBitrate
        });

        const stream = ytdl.downloadFromInfo(info, { format });

        stream.on('error', (error) => {
          logger.error('Error in ytdl stream:', {
            error: error.message,
            stack: error.stack,
            videoId
          });
          reject(error);
        });

        const writeStream = fs.createWriteStream(tempPath);

        writeStream.on('error', (error) => {
          logger.error('Error in write stream:', {
            error: error.message,
            path: tempPath
          });
          reject(error);
        });

        stream.pipe(writeStream)
          .on('finish', () => {
            const stats = fs.statSync(tempPath);
            logger.info(`Audio download completed: ${tempPath}`, {
              fileSize: stats.size
            });
            resolve();
          })
          .on('error', (error) => {
            logger.error('Error during audio download:', {
              error: error.message,
              stack: error.stack
            });
            reject(error);
          });
      }).catch(error => {
        logger.error('Failed to get video info:', {
          error: error.message,
          stack: error.stack,
          videoId
        });
        reject(error);
      });
    });

    // Verify the temp file exists and has content
    const tempStats = fs.statSync(tempPath);
    if (tempStats.size === 0) {
      throw new Error('Downloaded audio file is empty');
    }
    logger.info('Temp file verification:', {
      size: tempStats.size,
      path: tempPath
    });

    // Convert to optimal format for Whisper
    logger.info('Converting audio to FLAC format...');
    try {
      const { stdout, stderr } = await execAsync(`ffmpeg -i ${tempPath} -ar 16000 -ac 1 -c:a flac ${outputPath}`);
      logger.debug('FFmpeg output:', { stdout, stderr });
    } catch (error: any) {
      logger.error('FFmpeg conversion failed:', {
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr
      });
      throw error;
    }

    // Verify the output file
    const stats = fs.statSync(outputPath);
    if (stats.size === 0) {
      throw new Error('Converted FLAC file is empty');
    }
    logger.info('Audio conversion completed successfully:', {
      inputSize: tempStats.size,
      outputSize: stats.size,
      outputPath
    });

    // Clean up temp file
    fs.unlinkSync(tempPath);
    logger.info('Temporary MP3 file cleaned up');

    return outputPath;
  } catch (error) {
    logger.error('Error in downloadAudio:', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error,
      videoId,
      tempPath,
      outputPath
    });
    // Clean up any files in case of error
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
        logger.info('Cleaned up temp MP3 file after error');
      } catch (cleanupError) {
        logger.error('Failed to cleanup temp MP3 file:', cleanupError);
      }
    }
    if (fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
        logger.info('Cleaned up FLAC file after error');
      } catch (cleanupError) {
        logger.error('Failed to cleanup FLAC file:', cleanupError);
      }
    }
    throw error;
  }
}

async function transcribeWithWhisper(audioPath: string): Promise<string> {
  try {
    logger.info('Starting transcription process with OpenAI Whisper');

    // Verify input file
    const inputStats = fs.statSync(audioPath);
    logger.debug('Input file details:', {
      size: inputStats.size,
      path: audioPath
    });

    const openai = getOpenAIClient();
    if (!openai) {
      throw new Error('OpenAI API key not configured for Whisper transcription.');
    }

    // Read file as buffer
    const audioBuffer = await fs.promises.readFile(audioPath);
    logger.info(`Read audio file of size: ${audioBuffer.length} bytes`);

    try {
      logger.info('Sending request to OpenAI Whisper API...');
      const transcription = await openai.audio.transcriptions.create({
        file: new File([audioBuffer], 'audio.flac', { type: 'audio/flac' }),
        model: 'whisper-1',
        language: 'auto'
      });

      logger.info('Successfully received transcription from Whisper');
      return transcription.text;

    } catch (error: any) {
      logger.error('Transcription request failed:', error);
      throw new Error(`Whisper transcription failed: ${error.message || 'Unknown error'}`);
    }
  } finally {
    // Cleanup: Delete the temporary audio file
    try {
      await fs.promises.unlink(audioPath);
      logger.info('Cleaned up temporary audio file');
    } catch (error) {
      logger.error('Failed to delete temporary audio file:', error);
    }
  }
}

async function getSrtTranscript(srtId: string): Promise<{ transcript: string; source: 'srt'; title: string; youtubeId?: string }> {
  try {
    // Check if the srtId is already in the format "srt:fileId:youtubeId:filename"
    let fileId: string;
    let youtubeId: string | undefined;
    let originalFilename: string;

    if (srtId.startsWith('srt:')) {
      // Already in the correct format, no need to decode
      const parts = srtId.split(':');
      if (parts.length < 4) {
        // Old format or invalid format
        if (parts.length < 3) {
          throw new Error('Invalid SRT ID format');
        }
        fileId = parts[1];
        originalFilename = parts.slice(2).join(':'); // In case filename had colons
      } else {
        // New format with YouTube ID
        fileId = parts[1];
        youtubeId = parts[2];
        originalFilename = parts.slice(3).join(':'); // In case filename had colons
      }
    } else {
      // Try to decode from base64
      try {
        // Add padding if needed
        const paddedId = srtId.replace(/-/g, "+").replace(/_/g, "/");
        const pad = paddedId.length % 4;
        const paddedBase64 = pad ? paddedId + "=".repeat(4 - pad) : paddedId;

        const decodedId = atob(paddedBase64);
        const parts = decodedId.split(':');

        if (parts.length < 3 || parts[0] !== 'srt') {
          throw new Error('Invalid SRT ID format');
        }

        fileId = parts[1];

        if (parts.length >= 4) {
          // New format with YouTube ID
          youtubeId = parts[2];
          originalFilename = parts.slice(3).join(':'); // In case filename had colons
        } else {
          // Old format without YouTube ID
          originalFilename = parts.slice(2).join(':'); // In case filename had colons
        }
      } catch (decodeError) {
        logger.error('Error decoding SRT ID:', {
          error: decodeError instanceof Error ? {
            message: decodeError.message,
            stack: decodeError.stack
          } : decodeError,
          srtId
        });
        throw new Error(`Failed to decode SRT ID: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}`);
      }
    }

    // Construct the path to the SRT file
    const filePath = path.join(process.cwd(), 'tmp', `${fileId}.srt`);

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      throw new Error('SRT file not found. It may have been deleted or expired.');
    }

    // Read the SRT file
    const srtContent = await fs.promises.readFile(filePath, 'utf-8');

    // Parse the SRT content to plain text
    const transcript = srtToText(srtContent);

    // Use the original filename as the title, without the .srt extension
    let title = originalFilename.replace(/\.srt$/i, '');

    // Limit title length
    if (title.length > 100) {
      title = title.substring(0, 97) + '...';
    }
    if (title.length < 10) {
      title = 'SRT Subtitle Summary';
    }

    logger.info('Successfully processed SRT file', {
      fileId,
      originalFilename,
      transcriptLength: transcript.length
    });

    return {
      transcript,
      source: 'srt',
      title,
      youtubeId
    };
  } catch (error) {
    logger.error('Failed to process SRT file:', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error,
      srtId
    });
    throw new Error(`Failed to process SRT file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function getTranscript(videoId: string): Promise<{ transcript: string; source: 'youtube' | 'whisper' | 'srt'; title: string }> {
  try {
    // Ensure we have a clean video ID without any parameters (must be exactly 11 characters)
    // This is crucial for the YouTube transcript API which doesn't handle URLs with timestamps
    const cleanVideoId = videoId.length === 11 ? videoId : extractVideoId(videoId);

    logger.info(`Attempting to fetch YouTube transcript for video ${cleanVideoId}`);
    // Use clean video ID without any parameters
    const transcriptList = await YoutubeTranscript.fetchTranscript(cleanVideoId);

    // Extract title and process transcript as before
    const firstFewLines = transcriptList.slice(0, 5).map(item => item.text).join(' ');
    let title = firstFewLines.split('.')[0].trim();

    if (title.length > 100) {
      title = title.substring(0, 97) + '...';
    }
    if (title.length < 10) {
      title = `YouTube Video Summary`;
    }

    logger.info('Successfully retrieved YouTube transcript');
    logger.debug('Transcript details:', {
      title,
      length: transcriptList.length,
      firstLine: transcriptList[0]?.text
    });

    return {
      transcript: transcriptList.map(item => item.text).join(' '),
      source: 'youtube',
      title
    };
  } catch (error) {
    logger.info('YouTube transcript not available, falling back to Whisper...', {
      error: error instanceof Error ? error.message : String(error)
    });

    try {
      // Get video info for title - ensure we have a clean video ID
      logger.info('Fetching video info from YouTube');
      // Make sure we're using a clean video ID without any parameters
      const cleanVideoId = videoId.length === 11 ? videoId : extractVideoId(videoId);
      const videoInfo = await ytdl.getInfo(cleanVideoId).catch(infoError => {
        logger.error('Failed to get video info:', {
          error: infoError instanceof Error ? {
            message: infoError.message,
            stack: infoError.stack
          } : infoError,
          videoId
        });
        throw infoError;
      });

      const title = videoInfo.videoDetails.title;
      logger.info('Video info retrieved successfully:', {
        title,
        duration: videoInfo.videoDetails.lengthSeconds,
        author: videoInfo.videoDetails.author.name
      });

      // Check if OpenAI API is available
      const openai = getOpenAIClient();
      if (!openai) {
        const error = 'Transcript not available and OpenAI API key not configured for Whisper fallback.';
        logger.error(error, { message: error });
        throw new Error(error);
      }

      // Download and transcribe
      try {
        const audioPath = await downloadAudio(videoId);
        logger.info('Audio downloaded successfully', {
          path: audioPath,
          fileStats: fs.statSync(audioPath)
        });

        const transcript = await transcribeWithWhisper(audioPath);
        logger.info('Transcription completed successfully', {
          transcriptLength: transcript.length
        });

        return { transcript, source: 'whisper', title };
      } catch (processingError: unknown) {
        logger.error('Processing error:', {
          phase: typeof processingError === 'object' && processingError !== null && 'phase' in processingError ?
            (processingError as { phase?: string }).phase : 'unknown',
          error: processingError instanceof Error ? {
            message: processingError.message,
            stack: processingError.stack
          } : String(processingError)
        });
        throw processingError;
      }
    } catch (error) {
      logger.error('Failed to get transcript:', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : error,
        videoId
      });
      throw new Error(`Failed to process video: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Add new endpoint to check API key availability
export async function GET() {
  return NextResponse.json(checkApiKeyAvailability());
}

// Track active requests to prevent duplicate processing
const activeRequests = new Map<string, boolean>();

export async function POST(req: Request) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const writeProgress = async (data: any) => {
    await writer.write(encoder.encode(JSON.stringify(data) + '\n'));
  };

  (async () => {
    // Generate a unique request ID to track this request
    let requestId = '';

    try {
      const data = await req.json();
      const { language, mode, aiModel = 'deepseek' } = data;
      const url = data.url || '';
      const srtId = data.srtId || '';

      let videoId = '';
      let isSrtFile = false;

      // Check if this is an SRT file request
      if (srtId && srtId.startsWith('srt')) {
        videoId = srtId; // Use the SRT ID as the video ID for caching
        isSrtFile = true;
      } else if (url) {
        videoId = extractVideoId(url);
      } else {
        throw new Error('Either a YouTube URL or SRT file ID must be provided');
      }

      // Create a unique request ID based on the parameters
      requestId = `${videoId}-${language}-${mode}-${aiModel}`;

      // Check if this exact request is already being processed
      if (activeRequests.has(requestId)) {
        logger.info(`Duplicate request detected: ${requestId}. A similar request is already being processed.`);
        await writeProgress({
          type: 'progress',
          currentChunk: 0,
          totalChunks: 1,
          stage: 'analyzing',
          message: 'Another request for this video is already in progress. Please wait...'
        });

        // Return early with an informative message
        await writeProgress({
          type: 'error',
          error: 'Duplicate request',
          details: 'This video is already being processed in another tab or window. Please wait for that request to complete or refresh the page.'
        });

        await writer.close();
        return;
      }

      // Mark this request as active
      activeRequests.set(requestId, true);

      logger.info('Processing video request', {
        videoId,
        language,
        mode,
        aiModel,
        requestId
      });

      if (!AI_MODELS[aiModel as keyof typeof AI_MODELS]) {
        throw new Error(`Invalid AI model selected. Please choose from: ${Object.values(MODEL_NAMES).join(', ')}`);
      }

      const selectedModel = AI_MODELS[aiModel as keyof typeof AI_MODELS];
      logger.info(`Using ${MODEL_NAMES[aiModel as keyof typeof MODEL_NAMES]} model for generation...`);

      // Check cache first
      const existingSummary = await prisma.summary.findFirst({
        where: {
          videoId,
          language
        }
      });

      if (existingSummary) {
        await writeProgress({
          type: 'complete',
          summary: existingSummary.content,
          source: 'cache',
          status: 'completed'
        });
        await writer.close();
        return;
      }

      // Get transcript
      await writeProgress({
        type: 'progress',
        currentChunk: 0,
        totalChunks: 1,
        stage: 'analyzing',
        message: isSrtFile ? 'Processing SRT file...' : 'Fetching video transcript...'
      });

      let transcript, source, title;

      if (isSrtFile) {
        // Process SRT file
        const srtResult = await getSrtTranscript(srtId);
        transcript = srtResult.transcript;
        source = srtResult.source;
        title = srtResult.title;

        // If SRT file has a YouTube ID, use it instead of the SRT ID for database storage
        if (srtResult.youtubeId) {
          videoId = srtResult.youtubeId;
          logger.info(`Using YouTube ID from SRT file: ${videoId}`);
        }
      } else {
        // Process YouTube video
        const videoResult = await getTranscript(videoId);
        transcript = videoResult.transcript;
        source = videoResult.source;
        title = videoResult.title;
      }
      const chunks = await splitTranscriptIntoChunks(transcript);
      const totalChunks = chunks.length;
      const intermediateSummaries = [];

      // Process chunks
      for (let i = 0; i < chunks.length; i++) {
        await writeProgress({
          type: 'progress',
          currentChunk: i + 1,
          totalChunks,
          stage: 'processing',
          message: `Processing section ${i + 1} of ${totalChunks}...`
        });

        const chunkText = chunks[i];
        const wordCount = chunkText.split(' ').length;

        logger.info(
          `Processing chunk ${i + 1}/${totalChunks}:\n` +
          `- Words in this chunk: ${wordCount}`
        );

        const prompt = `Create a detailed summary of section ${i + 1} in ${language}.
        Maintain all important information, arguments, and connections.
        Pay special attention to:
        - Main topics and arguments
        - Important details and examples
        - Connections with other mentioned topics
        - Key statements and conclusions

        IMPORTANT: Base your summary STRICTLY on the provided content - do not include any imagined, fabricated, or speculative information that is not present in the original content.

        Text: ${chunkText}`;

        const text = await selectedModel.generateContent(prompt);
        logger.info(`Completed summary for chunk ${i + 1}/${totalChunks}`);
        intermediateSummaries.push(text);
      }

      // Generate final summary
      await writeProgress({
        type: 'progress',
        currentChunk: totalChunks,
        totalChunks,
        stage: 'finalizing',
        message: 'Creating final summary...'
      });

      const combinedSummary = intermediateSummaries.join('\n\n=== Next Section ===\n\n');
      const combinedWordCount = combinedSummary.split(' ').length;
      logger.info(
        `Creating final summary:\n` +
        `- Combined intermediate summaries: ${intermediateSummaries.length}\n` +
        `- Total word count: ${combinedWordCount}`
      );

      const finalPrompt = createSummaryPrompt(combinedSummary, language, mode);
      logger.info(`Sending final prompt to ${selectedModel.name} model`);

      const summary = await selectedModel.generateContent(finalPrompt);
      const summaryWordCount = summary ? summary.split(' ').length : 0;
      logger.info(
        `Final summary generated:\n` +
        `- Word count: ${summaryWordCount}\n` +
        `- Language: ${language}\n` +
        `- Mode: ${mode}`
      );

      if (!summary) {
        throw new Error('No summary content generated');
      }

      // Save to database
      await writeProgress({
        type: 'progress',
        currentChunk: totalChunks,
        totalChunks,
        stage: 'saving',
        message: 'Saving summary to history...'
      });

      try {
        // Check if summary already exists
        const existingSummary = await prisma.summary.findFirst({
          where: {
            videoId,
            language
          }
        });

        let savedSummary;
        if (existingSummary) {
          // Update existing summary
          savedSummary = await prisma.summary.update({
            where: {
              id: existingSummary.id
            },
            data: {
              content: summary,
              mode,
              source,
              updatedAt: new Date()
            }
          });
        } else {
          // Create new summary
          savedSummary = await prisma.summary.create({
            data: {
              videoId,
              title,
              content: summary,
              language,
              mode,
              source
            }
          });
        }

        await writeProgress({
          type: 'complete',
          summary: savedSummary.content,
          source: savedSummary.source || 'youtube',
          status: 'completed'
        });
      } catch (dbError: any) {
        console.warn('Warning: Failed to save to database -', dbError?.message || 'Unknown database error');

        // Still return the summary even if saving failed
        await writeProgress({
          type: 'complete',
          summary,
          source: source || 'youtube',
          status: 'completed',
          warning: 'Failed to save to history'
        });
      }

    } catch (error: any) {
      logger.error('Error processing video:', {
        error,
        stack: error?.stack,
        cause: error?.cause,
        requestId
      });

      // Determine if this is a DeepSeek API error
      const isDeepSeekError = error?.message?.includes('DeepSeek API error');

      // Create a user-friendly error message
      let errorMessage = error?.message || 'Failed to process video';
      let errorDetails = error?.toString() || 'Unknown error';

      // For DeepSeek errors, provide more context
      if (isDeepSeekError) {
        // The error message is already formatted in the DeepSeek model's error handler
        errorDetails = 'This error occurred while communicating with the DeepSeek API. ' +
                      'You may want to try a different AI model or try again later.';
      }

      await writeProgress({
        type: 'error',
        error: errorMessage,
        details: errorDetails,
        isDeepSeekError: isDeepSeekError
      }).catch((writeError) => {
        logger.error('Failed to write error progress:', writeError);
      });
    } finally {
      // Remove this request from active requests
      if (requestId) {
        activeRequests.delete(requestId);
        logger.info(`Request ${requestId} completed and removed from active requests`);
      }

      await writer.close().catch((closeError) => {
        logger.error('Failed to close writer:', closeError);
      });
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}