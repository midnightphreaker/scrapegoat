import yauzl from "yauzl";

export interface ZipBackedDocumentFormat {
  mimeType: string;
  extension: string;
}

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const MIMETYPE_FORMATS: Record<string, ZipBackedDocumentFormat> = {
  "application/vnd.oasis.opendocument.text": {
    mimeType: "application/vnd.oasis.opendocument.text",
    extension: ".odt",
  },
  "application/vnd.oasis.opendocument.spreadsheet": {
    mimeType: "application/vnd.oasis.opendocument.spreadsheet",
    extension: ".ods",
  },
  "application/vnd.oasis.opendocument.presentation": {
    mimeType: "application/vnd.oasis.opendocument.presentation",
    extension: ".odp",
  },
  "application/epub+zip": {
    mimeType: "application/epub+zip",
    extension: ".epub",
  },
};

function hasZipMagic(buffer: Buffer): boolean {
  return (
    buffer.length >= ZIP_MAGIC.length &&
    buffer[0] === ZIP_MAGIC[0] &&
    buffer[1] === ZIP_MAGIC[1] &&
    buffer[2] === ZIP_MAGIC[2] &&
    buffer[3] === ZIP_MAGIC[3]
  );
}

function readEntryText(
  zipfile: yauzl.ZipFile,
  entry: yauzl.Entry,
): Promise<string | null> {
  return new Promise((resolve) => {
    zipfile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        resolve(null);
        return;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      stream.on("data", (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes <= 1024) {
          chunks.push(chunk);
        }
      });
      stream.on("error", () => resolve(null));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8").trim()));
    });
  });
}

function classifyEntries(
  entries: Set<string>,
  mimetype: string | null,
): ZipBackedDocumentFormat | null {
  if (mimetype && MIMETYPE_FORMATS[mimetype]) {
    return MIMETYPE_FORMATS[mimetype];
  }

  if (entries.has("word/document.xml")) {
    return {
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension: ".docx",
    };
  }
  if (entries.has("xl/workbook.xml")) {
    return {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: ".xlsx",
    };
  }
  if (entries.has("ppt/presentation.xml")) {
    return {
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      extension: ".pptx",
    };
  }

  if (entries.has("meta-inf/container.xml")) {
    return MIMETYPE_FORMATS["application/epub+zip"];
  }

  return null;
}

export async function detectZipBackedDocumentFormat(
  buffer: Buffer,
): Promise<ZipBackedDocumentFormat | null> {
  if (!hasZipMagic(buffer)) {
    return null;
  }

  return new Promise((resolve) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zipfile) => {
      if (error || !zipfile) {
        resolve(null);
        return;
      }

      const entries = new Set<string>();
      let mimetype: string | null = null;
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        zipfile.close();
        resolve(classifyEntries(entries, mimetype));
      };

      zipfile.on("entry", (entry) => {
        const entryName = entry.fileName.toLowerCase();
        entries.add(entryName);

        if (entryName === "mimetype") {
          readEntryText(zipfile, entry)
            .then((value) => {
              mimetype = value;
              zipfile.readEntry();
            })
            .catch(() => {
              zipfile.readEntry();
            });
          return;
        }

        const earlyFormat = classifyEntries(entries, mimetype);
        if (earlyFormat) {
          finish();
          return;
        }

        zipfile.readEntry();
      });

      zipfile.on("end", finish);
      zipfile.on("error", () => {
        if (settled) return;
        settled = true;
        resolve(null);
      });
      zipfile.readEntry();
    });
  });
}
