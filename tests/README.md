# Tests

Copyright (c) 2025 Zherui Qiu

This directory contains test scripts for the YouTube Video Summarizer application.

## Available Tests

### YouTube URL Extraction Test

Tests the ability to extract video IDs from various YouTube URL formats, including URLs with time parameters.

**File**: `youtube-url-extraction.test.js`

**Run the test**:

```bash
node tests/youtube-url-extraction.test.js
```

This test verifies that the `extractVideoId` function can handle:
- Standard YouTube URLs
- URLs with time parameters (e.g., &t=16s)
- URLs with multiple parameters
- Shortened URLs (youtu.be)
- Embed URLs
- Shorts URLs
- Raw video IDs

## Adding New Tests

When adding new tests:

1. Create a new test file in this directory
2. Use a descriptive name ending with `.test.js`
3. Update this README with information about the new test
