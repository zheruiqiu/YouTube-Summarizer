/**
 * Copyright (c) 2025 Zherui Qiu
 *
 * This file is part of YouTube AI Summarizer.
 *
 * YouTube AI Summarizer is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * Utility functions for parsing SRT subtitle files.
 */

/**
 * Represents a subtitle entry in an SRT file
 */
interface SubtitleEntry {
  id: number;
  startTime: string;
  endTime: string;
  text: string;
}

/**
 * Parses an SRT file content into an array of subtitle entries
 * 
 * @param content The content of the SRT file as a string
 * @returns An array of parsed subtitle entries
 */
export function parseSrtContent(content: string): SubtitleEntry[] {
  // Split the content by double newlines to separate subtitle blocks
  const blocks = content.trim().split(/\r?\n\r?\n/);
  const entries: SubtitleEntry[] = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    
    // Skip invalid blocks
    if (lines.length < 3) continue;
    
    // Parse the subtitle ID
    const id = parseInt(lines[0].trim(), 10);
    if (isNaN(id)) continue;
    
    // Parse the timestamp line
    const timestampLine = lines[1];
    const timestampMatch = timestampLine.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
    if (!timestampMatch) continue;
    
    const [, startTime, endTime] = timestampMatch;
    
    // Join the remaining lines as the subtitle text
    const text = lines.slice(2).join(' ').trim();
    
    entries.push({
      id,
      startTime,
      endTime,
      text
    });
  }

  return entries;
}

/**
 * Converts parsed subtitle entries to plain text
 * 
 * @param entries Array of subtitle entries
 * @returns Plain text representation of the subtitles
 */
export function subtitlesToText(entries: SubtitleEntry[]): string {
  return entries.map(entry => entry.text).join(' ');
}

/**
 * Parses an SRT file content and returns the plain text representation
 * 
 * @param content The content of the SRT file as a string
 * @returns Plain text representation of the subtitles
 */
export function srtToText(content: string): string {
  const entries = parseSrtContent(content);
  return subtitlesToText(entries);
}
