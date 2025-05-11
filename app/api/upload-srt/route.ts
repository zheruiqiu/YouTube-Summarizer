/**
 * Copyright (c) 2025 Zherui Qiu
 *
 * This file is part of YouTube AI Summarizer.
 *
 * YouTube AI Summarizer is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { mkdir } from "fs/promises";
import { v4 as uuidv4 } from "uuid";

// Create a temporary directory for storing SRT files
const TMP_DIR = join(process.cwd(), "tmp");

export async function POST(req: NextRequest) {
  console.log("SRT upload API called");
  try {
    // Ensure the tmp directory exists
    await mkdir(TMP_DIR, { recursive: true });
    console.log("Temporary directory ensured:", TMP_DIR);

    const formData = await req.formData();
    console.log("Form data received, keys:", Array.from(formData.keys()));

    const srtFile = formData.get("srtFile") as File;
    const youtubeId = formData.get("youtubeId") as string;

    console.log("SRT file received:", srtFile ? srtFile.name : "none");
    console.log("YouTube ID received:", youtubeId);

    if (!srtFile) {
      return NextResponse.json(
        { error: "No SRT file provided" },
        { status: 400 }
      );
    }

    // YouTube video ID should be exactly 11 characters
    if (!youtubeId || youtubeId.length !== 11 || !youtubeId.match(/^[a-zA-Z0-9_-]{11}$/)) {
      return NextResponse.json(
        { error: "Valid YouTube video ID is required (11 characters)" },
        { status: 400 }
      );
    }

    // Check if it's an SRT file
    if (!srtFile.name.toLowerCase().endsWith(".srt")) {
      return NextResponse.json(
        { error: "Invalid file format. Only SRT files are accepted." },
        { status: 400 }
      );
    }

    // Generate a unique ID for the file
    const fileId = uuidv4();
    const fileName = `${fileId}.srt`;
    const filePath = join(TMP_DIR, fileName);
    console.log("Generated file ID:", fileId);
    console.log("File will be saved at:", filePath);

    try {
      // Convert the file to a Buffer and write it to disk
      const fileBuffer = Buffer.from(await srtFile.arrayBuffer());
      await writeFile(filePath, fileBuffer);
      console.log("File successfully written to disk");
    } catch (writeError) {
      console.error("Error writing file to disk:", writeError);
      throw writeError;
    }

    // Create the SRT ID in plain format (no encoding)
    // Include the YouTube ID in the SRT ID format
    const srtId = `srt:${fileId}:${youtubeId}:${srtFile.name}`;
    console.log("Generated SRT ID:", srtId);

    // Prepare response object
    const responseObj = {
      success: true,
      id: srtId,
      youtubeId: youtubeId
    };
    console.log("Sending response:", responseObj);

    // Return the file ID to be used in the summary route
    return NextResponse.json(responseObj);
  } catch (error) {
    console.error("Error uploading SRT file:", error);
    return NextResponse.json(
      { error: "Failed to upload SRT file" },
      { status: 500 }
    );
  }
}
