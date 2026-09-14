import { describe, expect, it } from 'vitest';
import { decodeText, extensionOf, readFileBytes, titleFromFileName } from './decode';

describe('titleFromFileName', () => {
  it('strips the extension and turns underscores into spaces', () => {
    expect(titleFromFileName('the-time_machine.epub')).toBe('the-time machine');
    expect(titleFromFileName('.txt')).toBe('Untitled');
  });
});

describe('extensionOf', () => {
  it('returns a lowercase extension without the dot', () => {
    expect(extensionOf('Book.EPUB')).toBe('epub');
    expect(extensionOf('no-extension')).toBe('');
  });
});

describe('decodeText', () => {
  it('honours a UTF-8 BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x48, 0x69]);
    expect(decodeText(bytes.buffer)).toBe('Hi');
  });

  it('decodes a UTF-16LE BOM', () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x48, 0x00, 0x69, 0x00]);
    expect(decodeText(bytes.buffer)).toBe('Hi');
  });
});

describe('readFileBytes', () => {
  it('reads a File through FileReader when arrayBuffer is missing', async () => {
    const file = new File(['abc'], 'n.txt');
    const bytes = new Uint8Array(await readFileBytes(file));
    expect([...bytes]).toEqual([97, 98, 99]);
  });
});
