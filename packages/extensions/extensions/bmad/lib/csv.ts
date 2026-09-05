/**
 * Shared CSV line parser (RFC 4180 subset).
 *
 * The BMAD installer writes its manifests (_config/skill-manifest.csv,
 * _bmad/<module>/module-help.csv) with double-quoted fields where ""
 * escapes a quote. Descriptions regularly contain commas and quotes, so
 * naive String.split(',') corrupts rows.
 */

/**
 * Parse a single CSV line with double-quoted fields ("" escapes a quote).
 */
export const parseCsvLine = (line: string): string[] => {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
};

/**
 * Split a CSV document into parsed rows, skipping blank lines.
 */
export const parseCsvRows = (content: string): string[][] => {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseCsvLine);
};

/**
 * Parse a CSV document into objects keyed by its header row.
 */
export const parseCsvObjects = (content: string): Array<Record<string, string>> => {
  const rows = parseCsvRows(content);
  if (rows.length === 0) {
    return [];
  }

  const header = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((key, i) => {
      obj[key.trim()] = (row[i] ?? '').trim();
    });
    return obj;
  });
};
