import { describe, expect, it } from 'vitest';

import { parseCsvLine, parseCsvObjects, parseCsvRows } from './csv';

describe('parseCsvLine', () => {
  it('splits plain fields', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('keeps commas inside quoted fields', () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });

  it('unescapes doubled quotes inside quoted fields', () => {
    expect(parseCsvLine('"say ""hi"" now",x')).toEqual(['say "hi" now', 'x']);
  });

  it('handles empty and trailing fields', () => {
    expect(parseCsvLine('a,,')).toEqual(['a', '', '']);
  });
});

describe('parseCsvRows', () => {
  it('splits on CRLF and skips blank lines', () => {
    const rows = parseCsvRows('a,b\r\nc,d\r\n\r\ne,f\n');
    expect(rows).toEqual([['a', 'b'], ['c', 'd'], ['e', 'f']]);
  });
});

describe('parseCsvObjects', () => {
  it('keys rows by the trimmed header row', () => {
    const objects = parseCsvObjects(' id , name \nbmad-prd,Create PRD');
    expect(objects).toEqual([{ id: 'bmad-prd', name: 'Create PRD' }]);
  });

  it('fills missing columns with empty strings', () => {
    const objects = parseCsvObjects('id,name,description\nbmad-help,BMAD Help');
    expect(objects).toEqual([{ id: 'bmad-help', name: 'BMAD Help', description: '' }]);
  });

  it('returns [] for empty documents and header-only documents', () => {
    expect(parseCsvObjects('')).toEqual([]);
    expect(parseCsvObjects('id,name\n')).toEqual([]);
  });
});
