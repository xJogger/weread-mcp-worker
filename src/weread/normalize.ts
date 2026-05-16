import { asArray, asRecord, secondsToDuration, unixSecondsToDate, wereadBookWebUrl, wereadBookmarkUrl, wereadReadingUrl } from "../utils/format";

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function normalizeBookInfo(value: unknown): Record<string, unknown> {
  const book = asRecord(value);
  const bookId = stringField(book, "bookId") || stringField(book, "bookid") || "";
  return {
    ...book,
    readingUrl: bookId ? wereadReadingUrl(bookId) : undefined,
    webUrl: bookId ? wereadBookWebUrl(bookId) : undefined,
    publishDate: unixSecondsToDate(numberField(book, "publishTime"))
  };
}

export function summarizeShelf(raw: Record<string, unknown>, limit: number): Record<string, unknown> {
  const books = asArray(raw.books);
  const albums = asArray(raw.albums);
  const mp = raw.mp;
  const hasMp = Boolean(mp && typeof mp === "object");

  const normalizedBooks = books.slice(0, limit).map((item) => {
    const book = asRecord(item);
    const bookId = String(book.bookId || "");
    return {
      bookId,
      title: book.title,
      author: book.author,
      cover: book.cover,
      category: book.category,
      readUpdateDate: unixSecondsToDate(numberField(book, "readUpdateTime")),
      finishReading: book.finishReading,
      isTop: book.isTop,
      secret: book.secret,
      readingUrl: bookId ? wereadReadingUrl(bookId) : undefined,
      webUrl: bookId ? wereadBookWebUrl(bookId) : undefined
    };
  });

  const normalizedAlbums = albums.slice(0, limit).map((item) => {
    const album = asRecord(item);
    const albumInfo = asRecord(album.albumInfo);
    const albumInfoExtra = asRecord(album.albumInfoExtra);
    return {
      albumId: albumInfo.albumId,
      name: albumInfo.name,
      authorName: albumInfo.authorName,
      cover: albumInfo.cover,
      trackCount: albumInfo.trackCount,
      finishStatus: albumInfo.finishStatus,
      secret: albumInfoExtra.secret,
      isTop: albumInfoExtra.isTop,
      updateDate: unixSecondsToDate(numberField(albumInfo, "updateTime"))
    };
  });

  const privateBooks = books.filter((item) => asRecord(item).secret === 1).length;
  const publicBooks = books.filter((item) => asRecord(item).secret !== 1).length;
  const privateAlbums = albums.filter((item) => asRecord(asRecord(item).albumInfoExtra).secret === 1).length;
  const publicAlbums = albums.filter((item) => asRecord(asRecord(item).albumInfoExtra).secret !== 1).length;

  return {
    summary: {
      totalShelfItems: books.length + albums.length + (hasMp ? 1 : 0),
      booksCount: books.length,
      albumsCount: albums.length,
      hasArticleCollection: hasMp,
      publicCount: publicBooks + publicAlbums,
      privateCount: privateBooks + privateAlbums + (hasMp ? 1 : 0),
      returnedBooks: normalizedBooks.length,
      returnedAlbums: normalizedAlbums.length
    },
    books: normalizedBooks,
    albums: normalizedAlbums,
    articleCollection: hasMp ? mp : undefined,
    archive: raw.archive
  };
}

export function normalizeProgress(raw: Record<string, unknown>): Record<string, unknown> {
  const book = asRecord(raw.book);
  return {
    ...raw,
    book: {
      ...book,
      progressLabel: typeof book.progress === "number" ? `${book.progress}%` : undefined,
      updateDate: unixSecondsToDate(numberField(book, "updateTime")),
      finishDate: unixSecondsToDate(numberField(book, "finishTime")),
      recordReadingTimeText: secondsToDuration(book.recordReadingTime)
    }
  };
}

export function normalizeHighlights(raw: Record<string, unknown>, limit: number): Record<string, unknown> {
  const book = asRecord(raw.book);
  const bookId = stringField(book, "bookId") || stringField(asRecord(asArray(raw.updated)[0]), "bookId") || "";
  const updated = asArray(raw.updated).slice(0, limit).map((item) => {
    const mark = asRecord(item);
    const chapterUid = mark.chapterUid as string | number | undefined;
    const range = typeof mark.range === "string" ? mark.range : undefined;
    return {
      ...mark,
      createDate: unixSecondsToDate(numberField(mark, "createTime")),
      deepLink: bookId && chapterUid !== undefined && range ? wereadBookmarkUrl(bookId, chapterUid, range) : undefined
    };
  });
  return {
    book,
    chapters: raw.chapters,
    totalHighlights: asArray(raw.updated).length,
    returnedHighlights: updated.length,
    highlights: updated
  };
}

export function normalizeReviewsMine(raw: Record<string, unknown>): Record<string, unknown> {
  const reviews = asArray(raw.reviews).map((item) => {
    const wrapper = asRecord(item);
    const review = asRecord(wrapper.review);
    return {
      ...wrapper,
      review: {
        ...review,
        createDate: unixSecondsToDate(numberField(review, "createTime"))
      }
    };
  });
  return { ...raw, reviews };
}

export function normalizeReadStats(raw: Record<string, unknown>): Record<string, unknown> {
  const readLongest = asArray(raw.readLongest).map((item) => {
    const row = asRecord(item);
    return {
      ...row,
      readTimeText: secondsToDuration(row.readTime),
      recordReadingTimeText: secondsToDuration(row.recordReadingTime)
    };
  });
  return {
    ...raw,
    totalReadTimeText: secondsToDuration(raw.totalReadTime),
    dayAverageReadTimeText: secondsToDuration(raw.dayAverageReadTime),
    readLongest
  };
}
