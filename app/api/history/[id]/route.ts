/**
 * Copyright (c) 2025 Zherui Qiu
 *
 * This file is part of YouTube AI Summarizer.
 *
 * YouTube AI Summarizer is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 */

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function extractTitleFromContent(content: string): string {
  try {
    const lines = content.split('\n');
    // Look for title in different formats
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('🎯 TITLE:') ||
          trimmedLine.startsWith('🎯 TITEL:') ||
          trimmedLine.startsWith('🎙️ TITLE:') ||
          trimmedLine.startsWith('🎙️ TITEL:')) {
        const title = trimmedLine.split(':')[1].trim();
        if (title) return title;
      }
    }
    // Fallback: Use first non-empty line if no title marker found
    const firstNonEmptyLine = lines.find(line => line.trim().length > 0);
    if (firstNonEmptyLine) {
      return firstNonEmptyLine.trim().replace(/^[🎯🎙️]\s*/, '');
    }
  } catch (error) {
    console.error('Error extracting title:', error);
  }
  return 'Untitled Summary';
}

type Props = {
  params: Promise<{ id: string }>
}

export async function GET(
  request: Request,
  { params }: Props
): Promise<Response> {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Summary ID is required' },
        { status: 400 }
      );
    }

    const summary = await prisma.summary.findUnique({
      where: { id }
    });

    if (!summary) {
      return NextResponse.json(
        { error: 'Summary not found' },
        { status: 404 }
      );
    }

    const extractedTitle = extractTitleFromContent(summary.content);

    return NextResponse.json({
      summary: {
        ...summary,
        title: extractedTitle,
        youtubeTitle: extractedTitle,
        youtubeThumbnail: null,
        youtubeDescription: ''
      }
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summary' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: Props
): Promise<Response> {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Summary ID is required' },
        { status: 400 }
      );
    }

    // Check if the summary exists
    const summary = await prisma.summary.findUnique({
      where: { id }
    });

    if (!summary) {
      return NextResponse.json(
        { error: 'Summary not found' },
        { status: 404 }
      );
    }

    // Delete the summary
    await prisma.summary.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Summary deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting summary:', error);
    return NextResponse.json(
      { error: 'Failed to delete summary' },
      { status: 500 }
    );
  }
}