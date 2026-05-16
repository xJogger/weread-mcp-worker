import { clampInteger, optionalInteger, asArray, asRecord, wereadBookWebUrl, wereadReadingUrl } from "../utils/format";
import { WeReadClient } from "../weread/client";
import { sanitizeWeReadError } from "../weread/errors";
import { normalizeBookInfo, normalizeHighlights, normalizeProgress, normalizeReadStats, normalizeReviewsMine, summarizeShelf } from "../weread/normalize";
import type { McpToolContext, McpToolDefinition, McpToolResult } from "./schema";
import { toolExecutionError, toolResult } from "./responses";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: false };
const READ_ONLY_IDEMPOTENT = { readOnlyHint: true, destructiveHint: false, idempotentHint: true };

const objectSchema = (properties: Record<string, unknown>, required: string[] = [], additionalProperties = false): Record<string, unknown> => ({
  type: "object",
  properties,
  required,
  additionalProperties
});

const outputObjectSchema = (properties: Record<string, unknown>, required: string[] = []): Record<string, unknown> => ({
  type: "object",
  properties,
  required,
  additionalProperties: true
});

const countProperty = (description: string, defaultValue: number, maximum = 100): Record<string, unknown> => ({
  type: "integer",
  minimum: 1,
  maximum,
  default: defaultValue,
  description
});

export const WEREAD_TOOLS: McpToolDefinition[] = [
  {
    name: "search",
    title: "Search WeRead books",
    description: "OpenAI data-only compatibility tool. Search WeRead bookstore results by keyword. Use fetch with an returned id like book:<bookId> to retrieve full book details.",
    inputSchema: objectSchema({ query: { type: "string", description: "Search query string." } }, ["query"]),
    outputSchema: outputObjectSchema({ results: { type: "array", items: { type: "object" } } }, ["results"]),
    annotations: READ_ONLY_IDEMPOTENT
  },
  {
    name: "fetch",
    title: "Fetch WeRead search result",
    description: "OpenAI data-only compatibility tool. Fetch full details for a WeRead search result id returned by search, for example book:3300045871.",
    inputSchema: objectSchema({ id: { type: "string", description: "Result id returned by search, usually book:<bookId>. A raw bookId is also accepted." } }, ["id"]),
    outputSchema: outputObjectSchema({ id: { type: "string" }, title: { type: "string" }, text: { type: "string" }, url: { type: "string" }, metadata: { type: "object" } }, ["id", "title", "text", "url"]),
    annotations: READ_ONLY_IDEMPOTENT
  },
  {
    name: "weread_search_books",
    title: "Search WeRead",
    description: "Search the WeRead store. Use this when the user provides a book title, author, keyword, or asks for a bookId. scope defaults to 10 for ebooks; use 0 for all tabs, 14 for audiobooks, 6 for authors, 12 for full-text, etc.",
    inputSchema: objectSchema({
      keyword: { type: "string", description: "Search keyword." },
      scope: { type: "integer", enum: [0, 2, 4, 6, 10, 12, 13, 14, 16], default: 10, description: "Search tab: 0 all, 10 ebooks, 16 web novels, 14 audiobooks, 6 authors, 12 full-text, 13 book lists, 2 accounts, 4 articles." },
      count: countProperty("Page size. Omit for WeRead default if not needed.", 10, 50),
      maxIdx: { type: "integer", minimum: 0, description: "Pagination offset from previous result searchIdx." }
    }, ["keyword"]),
    annotations: READ_ONLY_IDEMPOTENT
  },
  {
    name: "weread_get_bookshelf",
    title: "Get WeRead bookshelf",
    description: "Get the authenticated user's WeRead bookshelf summary. The total shelf count is books.length + albums.length + one article collection entry when mp exists.",
    inputSchema: objectSchema({
      limit: countProperty("Maximum number of books and albums to include in the response; counts are still computed from the full response.", 50, 500)
    }),
    annotations: READ_ONLY_IDEMPOTENT
  },
  {
    name: "weread_get_profile",
    title: "Get WeRead reading profile",
    description: "Composite profile overview based on the WeRead skill profile workflow: bookshelf summary, recent book reading progress, optional monthly/weekly/yearly/overall reading stats, notebook overview, and highlight counts for recent books.",
    inputSchema: objectSchema({
      limit: countProperty("Maximum number of books and albums to include in the embedded bookshelf response; shelf counts are still computed from the full response.", 50, 500),
      progressLimit: countProperty("Maximum recent ebook entries to fetch reading progress for.", 10, 50),
      includeReadingStats: { type: "boolean", default: true, description: "Whether to include /readdata/detail reading statistics." },
      statsMode: { type: "string", enum: ["weekly", "monthly", "annually", "overall"], default: "monthly", description: "Statistics period when includeReadingStats is true." },
      includeNotebookOverview: { type: "boolean", default: true, description: "Whether to include /user/notebooks overview for personal note counts." },
      notebookCount: countProperty("Number of notebook overview rows to include when includeNotebookOverview is true.", 10, 100),
      highlightCountLimit: { type: "integer", minimum: 0, maximum: 20, default: 5, description: "Number of recent ebooks for which to fetch /book/bookmarklist highlight counts. Set 0 to disable." }
    }),
    annotations: READ_ONLY
  },
  {
    name: "weread_get_book_info",
    title: "Get WeRead book info",
    description: "Get basic metadata for one WeRead book by bookId, including title, author, intro, category, publisher, ISBN, rating, and open links.",
    inputSchema: objectSchema({ bookId: { type: "string", description: "WeRead book ID." } }, ["bookId"]),
    annotations: READ_ONLY_IDEMPOTENT
  },
  {
    name: "weread_get_book_chapters",
    title: "Get WeRead chapters",
    description: "Get the chapter table of contents for a WeRead book. chapterUid values can be used with underlines and best bookmark tools.",
    inputSchema: objectSchema({
      bookId: { type: "string", description: "WeRead book ID." },
      limit: countProperty("Maximum chapters to return.", 200, 1000)
    }, ["bookId"]),
    annotations: READ_ONLY_IDEMPOTENT
  },
  {
    name: "weread_get_reading_progress",
    title: "Get reading progress",
    description: "Get the authenticated user's reading progress for a book. progress is 0-100 percent; 1 means 1%, not 100%.",
    inputSchema: objectSchema({ bookId: { type: "string", description: "WeRead book ID." } }, ["bookId"]),
    annotations: READ_ONLY_IDEMPOTENT
  },
  {
    name: "weread_get_notebooks",
    title: "Get notebook overview",
    description: "Get the user's notebook overview: books with personal note counts. Total note count per book is reviewCount + noteCount + bookmarkCount. Pagination uses lastSort, not offset/limit.",
    inputSchema: objectSchema({
      count: countProperty("Page size for /user/notebooks.", 20, 100),
      lastSort: { type: "integer", description: "Cursor from previous page: books[last].sort." },
      fetchAll: { type: "boolean", default: false, description: "When true, follow hasMore until maxPages is reached." },
      maxPages: { type: "integer", minimum: 1, maximum: 20, default: 5, description: "Maximum pages to fetch when fetchAll is true." }
    }),
    annotations: READ_ONLY
  },
  {
    name: "weread_get_book_highlights",
    title: "Get personal highlights",
    description: "Get personal highlight text for a book via /book/bookmarklist. This endpoint returns highlights (type=1) and not bookmark-position content.",
    inputSchema: objectSchema({
      bookId: { type: "string", description: "WeRead book ID." },
      limit: countProperty("Maximum highlights to return after fetching the book highlight list.", 200, 1000)
    }, ["bookId"]),
    annotations: READ_ONLY_IDEMPOTENT
  },
  {
    name: "weread_get_book_reviews_mine",
    title: "Get personal thoughts/reviews",
    description: "Get the authenticated user's personal thoughts and reviews for a book via /review/list/mine, including highlight thoughts, chapter comments, and whole-book reviews.",
    inputSchema: objectSchema({
      bookId: { type: "string", description: "WeRead book ID." },
      synckey: { type: "integer", minimum: 0, default: 0, description: "Pagination cursor returned by previous call." },
      count: countProperty("Page size.", 50, 100)
    }, ["bookId"]),
    annotations: READ_ONLY
  },
  {
    name: "weread_get_book_notes",
    title: "Get personal book notes",
    description: "Composite tool: fetch personal highlights and personal thoughts/reviews for a book, then return both in one response. Bookmarks are only available as counts from weread_get_notebooks and are not exported as content.",
    inputSchema: objectSchema({
      bookId: { type: "string", description: "WeRead book ID." },
      highlightsLimit: countProperty("Maximum highlight items to include.", 200, 1000),
      reviewsCount: countProperty("Personal thoughts/reviews page size.", 100, 100),
      reviewsSynckey: { type: "integer", minimum: 0, default: 0, description: "Cursor for personal thoughts/reviews." }
    }, ["bookId"]),
    annotations: READ_ONLY
  },
  {
    name: "weread_get_chapter_underlines",
    title: "Get chapter underline heat",
    description: "Get underline heat statistics for one chapter. This contains ranges, counts, scores, and types, but not highlight text.",
    inputSchema: objectSchema({
      bookId: { type: "string", description: "WeRead book ID." },
      chapterUid: { type: "integer", description: "Chapter UID from weread_get_book_chapters." },
      synckey: { type: "integer", minimum: 0, default: 0 }
    }, ["bookId", "chapterUid"]),
    annotations: READ_ONLY
  },
  {
    name: "weread_get_best_bookmarks",
    title: "Get popular highlights",
    description: "Get popular highlights for a book or chapter. The WeRead service returns a fixed top set and does not support arbitrary pagination.",
    inputSchema: objectSchema({
      bookId: { type: "string", description: "WeRead book ID." },
      chapterUid: { type: "integer", minimum: 0, default: 0, description: "0 or omitted means all chapters." },
      synckey: { type: "integer", minimum: 0, default: 0 }
    }, ["bookId"]),
    annotations: READ_ONLY
  },
  {
    name: "weread_get_readreviews",
    title: "Get thoughts under highlights",
    description: "Get public thoughts/comments under one or more highlight ranges via /book/readreviews. Ranges usually come from weread_get_best_bookmarks.",
    inputSchema: objectSchema({
      bookId: { type: "string", description: "WeRead book ID." },
      chapterUid: { type: "integer", description: "Chapter UID." },
      reviews: {
        type: "array",
        minItems: 1,
        maxItems: 10,
        description: "Highlight range requests.",
        items: objectSchema({
          range: { type: "string", description: "Highlight range such as 393-401." },
          maxIdx: { type: "integer", minimum: 0, default: 0 },
          count: { type: "integer", minimum: 1, maximum: 20, default: 10 },
          synckey: { type: "integer", minimum: 0, default: 0 }
        }, ["range"])
      }
    }, ["bookId", "chapterUid", "reviews"]),
    annotations: READ_ONLY
  },
  {
    name: "weread_get_review_detail",
    title: "Get review detail",
    description: "Get a single thought/review detail by reviewId, including optional comments and likes.",
    inputSchema: objectSchema({
      reviewId: { type: "string", description: "Review/thought ID." },
      commentsCount: { type: "integer", minimum: 0, maximum: 50, default: 10 },
      commentsDirection: { type: "integer", enum: [0, 1], default: 0 },
      likesCount: { type: "integer", minimum: 0, maximum: 50, default: 10 },
      likesDirection: { type: "integer", enum: [0], default: 0 },
      synckey: { type: "integer", minimum: 0, default: 0 }
    }, ["reviewId"]),
    annotations: READ_ONLY
  },
  {
    name: "weread_get_public_reviews",
    title: "Get public book reviews",
    description: "Get public reviews for a WeRead book. reviewListType: 0 all, 1 recommended, 2 negative, 3 latest, 4 average.",
    inputSchema: objectSchema({
      bookId: { type: "string", description: "WeRead book ID." },
      reviewListType: { type: "integer", enum: [0, 1, 2, 3, 4], default: 0 },
      count: countProperty("Page size.", 20, 50),
      maxIdx: { type: "integer", minimum: 0, default: 0 },
      synckey: { type: "integer", minimum: 0, default: 0 }
    }, ["bookId"]),
    annotations: READ_ONLY
  },
  {
    name: "weread_get_reading_stats",
    title: "Get reading statistics",
    description: "Get personal reading statistics via /readdata/detail. Durations are seconds in the API and are also returned with human-readable labels.",
    inputSchema: objectSchema({
      mode: { type: "string", enum: ["weekly", "monthly", "annually", "overall"], default: "monthly", description: "Statistics period." },
      baseTime: { type: "integer", minimum: 0, description: "Unix timestamp inside the desired period. Omit or 0 for current period; overall uses 0." }
    }),
    annotations: READ_ONLY
  },
  {
    name: "weread_get_recommendations",
    title: "Get WeRead recommendations",
    description: "Get personalized WeRead recommendations via /book/recommend.",
    inputSchema: objectSchema({
      count: countProperty("Page size.", 12, 50),
      maxIdx: { type: "integer", minimum: 0, default: 0 }
    }),
    annotations: READ_ONLY
  },
  {
    name: "weread_get_similar_books",
    title: "Get similar WeRead books",
    description: "Get books similar to a given WeRead book via /book/similar. Use sessionId returned from a previous page when paginating.",
    inputSchema: objectSchema({
      bookId: { type: "string", description: "WeRead book ID." },
      count: countProperty("Page size.", 12, 50),
      maxIdx: { type: "integer", minimum: 0, default: 0 },
      sessionId: { type: "string", description: "Pagination session ID from previous response." }
    }, ["bookId"]),
    annotations: READ_ONLY
  }
];

const TOOL_NAMES = new Set(WEREAD_TOOLS.map((tool) => tool.name));

function client(context: McpToolContext): WeReadClient {
  return WeReadClient.fromEnv(context.apiKey, context.env);
}

function requiredString(args: Record<string, unknown>, name: string): string {
  const value = args[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required string parameter: ${name}`);
  }
  return value.trim();
}

function optionalString(args: Record<string, unknown>, name: string): string | undefined {
  const value = args[name];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`Parameter ${name} must be a string.`);
  return value.trim();
}

function getArgs(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Tool arguments must be an object.");
  return value as Record<string, unknown>;
}

function extractSearchResults(raw: Record<string, unknown>, limit = 20): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];
  for (const groupValue of asArray(raw.results)) {
    const group = asRecord(groupValue);
    for (const bookValue of asArray(group.books)) {
      const row = asRecord(bookValue);
      const bookInfo = asRecord(row.bookInfo || row.book || row);
      const bookId = typeof bookInfo.bookId === "string" ? bookInfo.bookId : String(bookInfo.bookId || "");
      if (!bookId) continue;
      rows.push({
        id: `book:${bookId}`,
        title: typeof bookInfo.title === "string" ? bookInfo.title : bookId,
        url: wereadBookWebUrl(bookId),
        bookId,
        author: bookInfo.author,
        cover: bookInfo.cover,
        intro: bookInfo.intro,
        category: bookInfo.category,
        newRating: row.newRating ?? bookInfo.newRating,
        newRatingCount: row.newRatingCount ?? bookInfo.newRatingCount,
        readingCount: row.readingCount,
        searchIdx: row.searchIdx,
        scope: group.scope,
        groupTitle: group.title
      });
      if (rows.length >= limit) return rows;
    }
  }
  return rows;
}

function searchParams(args: Record<string, unknown>, defaultCount: number): Record<string, unknown> {
  const params: Record<string, unknown> = {
    keyword: requiredString(args, "keyword"),
    scope: clampInteger(args.scope, 10, 0, 16)
  };
  if (args.count !== undefined) params.count = clampInteger(args.count, defaultCount, 1, 50);
  const maxIdx = optionalInteger(args.maxIdx, 0, 1_000_000_000);
  if (maxIdx !== undefined) params.maxIdx = maxIdx;
  return params;
}

export async function callWeReadTool(name: string, rawArguments: unknown, context: McpToolContext): Promise<McpToolResult> {
  if (!TOOL_NAMES.has(name)) {
    return toolExecutionError(`Unknown tool: ${name}`);
  }

  try {
    const args = getArgs(rawArguments);
    const api = client(context);

    switch (name) {
      case "search": {
        const query = requiredString(args, "query");
        const raw = await api.call("/store/search", { keyword: query, scope: 10, count: 10 });
        const results = extractSearchResults(raw, 10).map(({ id, title, url }) => ({ id, title, url }));
        return toolResult({ results });
      }

      case "fetch": {
        const id = requiredString(args, "id");
        const bookId = id.startsWith("book:") ? id.slice("book:".length) : id;
        const raw = await api.call("/book/info", { bookId });
        const book = normalizeBookInfo(raw);
        const title = typeof book.title === "string" ? book.title : bookId;
        const author = typeof book.author === "string" ? book.author : "";
        const intro = typeof book.intro === "string" ? book.intro : "";
        const text = [`书名：${title}`, author ? `作者：${author}` : "", intro ? `简介：${intro}` : ""].filter(Boolean).join("\n");
        return toolResult({
          id: `book:${bookId}`,
          title,
          text,
          url: wereadBookWebUrl(bookId),
          metadata: book
        });
      }

      case "weread_search_books": {
        const raw = await api.call("/store/search", searchParams(args, 10));
        return toolResult({ ...raw, flatResults: extractSearchResults(raw, 50) });
      }

      case "weread_get_bookshelf": {
        const limit = clampInteger(args.limit, 50, 1, 500);
        const raw = await api.call("/shelf/sync");
        return toolResult(summarizeShelf(raw, limit));
      }

      case "weread_get_profile": {
        const limit = clampInteger(args.limit, 50, 1, 500);
        const progressLimit = clampInteger(args.progressLimit, 10, 1, 50);
        const includeReadingStats = args.includeReadingStats !== false;
        const includeNotebookOverview = args.includeNotebookOverview !== false;
        const notebookCount = clampInteger(args.notebookCount, 10, 1, 100);
        const highlightCountLimit = clampInteger(args.highlightCountLimit, 5, 0, 20);
        const statsMode = optionalString(args, "statsMode") || "monthly";
        if (!["weekly", "monthly", "annually", "overall"].includes(statsMode)) {
          throw new Error("statsMode must be weekly, monthly, annually, or overall.");
        }

        const shelfRaw = await api.call("/shelf/sync");
        const shelf = summarizeShelf(shelfRaw, limit);
        const allBooks = asArray(shelfRaw.books).map((item) => asRecord(item));
        const recentBooks = [...allBooks]
          .sort((left, right) => {
            const leftTime = typeof left.readUpdateTime === "number" ? left.readUpdateTime : 0;
            const rightTime = typeof right.readUpdateTime === "number" ? right.readUpdateTime : 0;
            return rightTime - leftTime;
          })
          .slice(0, progressLimit)
          .filter((book) => typeof book.bookId === "string" && book.bookId.trim());

        const progressSettled = await Promise.allSettled(
          recentBooks.map(async (book) => {
            const bookId = String(book.bookId);
            const progress = await api.call("/book/getprogress", { bookId });
            return {
              bookId,
              title: book.title,
              author: book.author,
              category: book.category,
              readUpdateTime: book.readUpdateTime,
              readingUrl: wereadReadingUrl(bookId),
              webUrl: wereadBookWebUrl(bookId),
              progress: normalizeProgress(progress)
            };
          })
        );

        const recentReading = progressSettled.map((result, index) => {
          const fallback = recentBooks[index] || {};
          const bookId = String(fallback.bookId || "");
          if (result.status === "fulfilled") return result.value;
          return {
            bookId,
            title: fallback.title,
            author: fallback.author,
            category: fallback.category,
            readUpdateTime: fallback.readUpdateTime,
            readingUrl: bookId ? wereadReadingUrl(bookId) : undefined,
            webUrl: bookId ? wereadBookWebUrl(bookId) : undefined,
            error: sanitizeWeReadError(result.reason)
          };
        });

        const [statsSettled, notebooksSettled, highlightCountsSettled] = await Promise.allSettled([
          includeReadingStats ? api.call("/readdata/detail", { mode: statsMode }) : Promise.resolve(undefined),
          includeNotebookOverview ? api.call("/user/notebooks", { count: notebookCount }) : Promise.resolve(undefined),
          highlightCountLimit > 0
            ? Promise.allSettled(
                recentBooks.slice(0, highlightCountLimit).map(async (book) => {
                  const bookId = String(book.bookId);
                  const raw = await api.call("/book/bookmarklist", { bookId });
                  return {
                    bookId,
                    title: book.title,
                    author: book.author,
                    highlightCount: asArray(raw.updated).length
                  };
                })
              )
            : Promise.resolve(undefined)
        ]);

        let readingStats: unknown;
        if (includeReadingStats) {
          readingStats = statsSettled.status === "fulfilled" && statsSettled.value ? normalizeReadStats(statsSettled.value) : { error: statsSettled.status === "rejected" ? sanitizeWeReadError(statsSettled.reason) : "Unavailable" };
        }

        let notebookOverview: unknown;
        if (includeNotebookOverview) {
          if (notebooksSettled.status === "fulfilled" && notebooksSettled.value) {
            const raw = notebooksSettled.value;
            notebookOverview = {
              totalBookCount: raw.totalBookCount,
              totalNoteCount: raw.totalNoteCount,
              hasMore: raw.hasMore,
              books: asArray(raw.books).map((item) => {
                const row = asRecord(item);
                const book = asRecord(row.book);
                const bookId = String(row.bookId || book.bookId || "");
                const reviewCount = typeof row.reviewCount === "number" ? row.reviewCount : 0;
                const noteCount = typeof row.noteCount === "number" ? row.noteCount : 0;
                const bookmarkCount = typeof row.bookmarkCount === "number" ? row.bookmarkCount : 0;
                return {
                  ...row,
                  book,
                  bookId,
                  totalNoteCountForBook: reviewCount + noteCount + bookmarkCount,
                  readingUrl: bookId ? wereadReadingUrl(bookId) : undefined,
                  webUrl: bookId ? wereadBookWebUrl(bookId) : undefined
                };
              })
            };
          } else {
            notebookOverview = { error: notebooksSettled.status === "rejected" ? sanitizeWeReadError(notebooksSettled.reason) : "Unavailable" };
          }
        }

        let highlightCounts: unknown;
        if (highlightCountLimit > 0) {
          if (highlightCountsSettled.status === "fulfilled" && Array.isArray(highlightCountsSettled.value)) {
            highlightCounts = highlightCountsSettled.value.map((result, index) => {
              const fallback = recentBooks[index] || {};
              if (result.status === "fulfilled") return result.value;
              return {
                bookId: fallback.bookId,
                title: fallback.title,
                author: fallback.author,
                error: sanitizeWeReadError(result.reason)
              };
            });
          } else {
            highlightCounts = { error: highlightCountsSettled.status === "rejected" ? sanitizeWeReadError(highlightCountsSettled.reason) : "Unavailable" };
          }
        }

        return toolResult({
          generatedAt: new Date().toISOString(),
          profileScope: "bookshelf + recent reading progress + optional reading stats + optional notebook overview + optional recent highlight counts",
          shelf,
          recentReading,
          readingStats,
          notebookOverview,
          highlightCounts
        });
      }

      case "weread_get_book_info": {
        const bookId = requiredString(args, "bookId");
        const raw = await api.call("/book/info", { bookId });
        return toolResult(normalizeBookInfo(raw));
      }

      case "weread_get_book_chapters": {
        const bookId = requiredString(args, "bookId");
        const limit = clampInteger(args.limit, 200, 1, 1000);
        const raw = await api.call("/book/chapterinfo", { bookId });
        const chapters = asArray(raw.chapters).slice(0, limit).map((item) => {
          const chapter = asRecord(item);
          return {
            ...chapter,
            readingUrl: chapter.chapterUid !== undefined ? `${wereadReadingUrl(bookId)}&chapterUid=${encodeURIComponent(String(chapter.chapterUid))}` : undefined
          };
        });
        return toolResult({ ...raw, totalChapters: asArray(raw.chapters).length, returnedChapters: chapters.length, chapters });
      }

      case "weread_get_reading_progress": {
        const raw = await api.call("/book/getprogress", { bookId: requiredString(args, "bookId") });
        return toolResult(normalizeProgress(raw));
      }

      case "weread_get_notebooks": {
        const count = clampInteger(args.count, 20, 1, 100);
        const fetchAll = args.fetchAll === true;
        const maxPages = clampInteger(args.maxPages, 5, 1, 20);
        const books: unknown[] = [];
        let lastSort = optionalInteger(args.lastSort, 0, 9_999_999_999);
        let page = 0;
        let lastRaw: Record<string, unknown> = {};
        do {
          const params: Record<string, unknown> = { count };
          if (lastSort !== undefined) params.lastSort = lastSort;
          lastRaw = await api.call("/user/notebooks", params);
          const pageBooks = asArray(lastRaw.books);
          books.push(...pageBooks);
          page += 1;
          const lastBook = asRecord(pageBooks[pageBooks.length - 1]);
          lastSort = typeof lastBook.sort === "number" ? lastBook.sort : undefined;
          if (!fetchAll) break;
        } while (lastRaw.hasMore === 1 && lastSort !== undefined && page < maxPages);

        const normalizedBooks = books.map((item) => {
          const row = asRecord(item);
          const book = asRecord(row.book);
          const bookId = String(row.bookId || book.bookId || "");
          const reviewCount = typeof row.reviewCount === "number" ? row.reviewCount : 0;
          const noteCount = typeof row.noteCount === "number" ? row.noteCount : 0;
          const bookmarkCount = typeof row.bookmarkCount === "number" ? row.bookmarkCount : 0;
          return {
            ...row,
            book,
            bookId,
            totalNoteCountForBook: reviewCount + noteCount + bookmarkCount,
            readingUrl: bookId ? wereadReadingUrl(bookId) : undefined,
            webUrl: bookId ? wereadBookWebUrl(bookId) : undefined
          };
        });
        return toolResult({
          totalBookCount: lastRaw.totalBookCount,
          totalNoteCount: lastRaw.totalNoteCount,
          hasMore: lastRaw.hasMore,
          nextLastSort: lastSort,
          pagesFetched: page,
          books: normalizedBooks
        });
      }

      case "weread_get_book_highlights": {
        const bookId = requiredString(args, "bookId");
        const limit = clampInteger(args.limit, 200, 1, 1000);
        const raw = await api.call("/book/bookmarklist", { bookId });
        return toolResult(normalizeHighlights(raw, limit));
      }

      case "weread_get_book_reviews_mine": {
        const bookid = requiredString(args, "bookId");
        const params = {
          bookid,
          count: clampInteger(args.count, 50, 1, 100),
          synckey: clampInteger(args.synckey, 0, 0, 9_999_999_999)
        };
        const raw = await api.call("/review/list/mine", params);
        return toolResult(normalizeReviewsMine(raw));
      }

      case "weread_get_book_notes": {
        const bookId = requiredString(args, "bookId");
        const highlightsLimit = clampInteger(args.highlightsLimit, 200, 1, 1000);
        const reviewsCount = clampInteger(args.reviewsCount, 100, 1, 100);
        const reviewsSynckey = clampInteger(args.reviewsSynckey, 0, 0, 9_999_999_999);
        const [highlightsRaw, reviewsRaw] = await Promise.all([
          api.call("/book/bookmarklist", { bookId }),
          api.call("/review/list/mine", { bookid: bookId, count: reviewsCount, synckey: reviewsSynckey })
        ]);
        return toolResult({
          bookId,
          highlights: normalizeHighlights(highlightsRaw, highlightsLimit),
          reviews: normalizeReviewsMine(reviewsRaw),
          noteExportScope: "highlights + personal thoughts/reviews; bookmark positions are not exportable via current API"
        });
      }

      case "weread_get_chapter_underlines": {
        const raw = await api.call("/book/underlines", {
          bookId: requiredString(args, "bookId"),
          chapterUid: clampInteger(args.chapterUid, 0, 0, 9_999_999_999),
          synckey: clampInteger(args.synckey, 0, 0, 9_999_999_999)
        });
        return toolResult(raw);
      }

      case "weread_get_best_bookmarks": {
        const raw = await api.call("/book/bestbookmarks", {
          bookId: requiredString(args, "bookId"),
          chapterUid: clampInteger(args.chapterUid, 0, 0, 9_999_999_999),
          synckey: clampInteger(args.synckey, 0, 0, 9_999_999_999)
        });
        return toolResult(raw);
      }

      case "weread_get_readreviews": {
        const reviews = asArray(args.reviews).slice(0, 10).map((item) => {
          const review = asRecord(item);
          const range = typeof review.range === "string" ? review.range : "";
          if (!range) throw new Error("Each reviews item must include range.");
          return {
            range,
            maxIdx: clampInteger(review.maxIdx, 0, 0, 9_999_999_999),
            count: clampInteger(review.count, 10, 1, 20),
            synckey: clampInteger(review.synckey, 0, 0, 9_999_999_999)
          };
        });
        if (reviews.length === 0) throw new Error("reviews must contain at least one range.");
        const raw = await api.call("/book/readreviews", {
          bookId: requiredString(args, "bookId"),
          chapterUid: clampInteger(args.chapterUid, 0, 0, 9_999_999_999),
          reviews
        });
        return toolResult(raw);
      }

      case "weread_get_review_detail": {
        const raw = await api.call("/review/single", {
          reviewId: requiredString(args, "reviewId"),
          commentsCount: clampInteger(args.commentsCount, 10, 0, 50),
          commentsDirection: clampInteger(args.commentsDirection, 0, 0, 1),
          likesCount: clampInteger(args.likesCount, 10, 0, 50),
          likesDirection: 0,
          synckey: clampInteger(args.synckey, 0, 0, 9_999_999_999)
        });
        return toolResult(raw);
      }

      case "weread_get_public_reviews": {
        const raw = await api.call("/review/list", {
          bookId: requiredString(args, "bookId"),
          reviewListType: clampInteger(args.reviewListType, 0, 0, 4),
          count: clampInteger(args.count, 20, 1, 50),
          maxIdx: clampInteger(args.maxIdx, 0, 0, 9_999_999_999),
          synckey: clampInteger(args.synckey, 0, 0, 9_999_999_999)
        });
        return toolResult(raw);
      }

      case "weread_get_reading_stats": {
        const mode = optionalString(args, "mode") || "monthly";
        if (!["weekly", "monthly", "annually", "overall"].includes(mode)) throw new Error("mode must be weekly, monthly, annually, or overall.");
        const params: Record<string, unknown> = { mode };
        const baseTime = optionalInteger(args.baseTime, 0, 9_999_999_999);
        if (baseTime !== undefined) params.baseTime = baseTime;
        const raw = await api.call("/readdata/detail", params);
        return toolResult(normalizeReadStats(raw));
      }

      case "weread_get_recommendations": {
        const raw = await api.call("/book/recommend", {
          count: clampInteger(args.count, 12, 1, 50),
          maxIdx: clampInteger(args.maxIdx, 0, 0, 9_999_999_999)
        });
        return toolResult(raw);
      }

      case "weread_get_similar_books": {
        const params: Record<string, unknown> = {
          bookId: requiredString(args, "bookId"),
          count: clampInteger(args.count, 12, 1, 50),
          maxIdx: clampInteger(args.maxIdx, 0, 0, 9_999_999_999)
        };
        const sessionId = optionalString(args, "sessionId");
        if (sessionId) params.sessionId = sessionId;
        const raw = await api.call("/book/similar", params);
        return toolResult(raw);
      }

      default:
        return toolExecutionError(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return toolExecutionError(sanitizeWeReadError(error));
  }
}
