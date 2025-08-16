---
sidebar_position: 2
title: "Web Scraping"
sidebar_label: "Web Scraping"
---

# Web Scraping

AiderDesk includes a powerful web scraping feature that allows you to pull content from any URL directly into your chat context. This is incredibly useful for providing the AI with external information, such as documentation, articles, or API references.

## How to Use

To use the web scraper, simply use the `/web` command followed by the URL you want to scrape.

**Example:**
```
/web https://react.dev/reference/react/useState
```

## How It Works

When you execute the `/web` command, AiderDesk performs the following steps in the background:

1.  **Launch Playwright**: A headless browser instance is launched using [Playwright](https://playwright.dev/). This allows AiderDesk to render JavaScript-heavy websites, ensuring it gets the full content just as a user would see it.
2.  **Navigate and Extract**: The browser navigates to the specified URL and waits for the page to fully load. It then extracts the raw HTML of the page.
3.  **Clean and Convert**: The raw HTML is processed using [Cheerio](https://cheerio.js.org/). Unnecessary elements like images, SVGs, and scripts are removed. The remaining structured content (headings, paragraphs, lists, etc.) is converted into a clean, markdown-like text format.
4.  **Add to Context**: The cleaned text is saved to a temporary file within your project's `.aider-desk/tmp` directory. This file is then automatically added to your chat context as a **read-only** file.

A log message will appear in the chat confirming that the content has been scraped and added to the context, along with the path to the temporary file. The AI can now use this information to answer your questions or complete your tasks.
