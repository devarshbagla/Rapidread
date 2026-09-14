import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { parseEpub } from './epub';
import { ImportError } from './errors';

const PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function epubFile(name: string, build: (zip: JSZip) => void): Promise<File> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  build(zip);
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], name, { type: 'application/epub+zip' });
}

function standardBook(zip: JSZip, options?: { cover?: boolean }): void {
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?>
     <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
       <rootfiles>
         <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
       </rootfiles>
     </container>`,
  );
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0"?>
     <package xmlns="http://www.idpf.org/2007/opf" unique-identifier="id" version="3.0">
       <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
         <dc:title>The Time Machine</dc:title>
         <dc:creator>H. G. Wells</dc:creator>
         ${options?.cover === true ? '<meta name="cover" content="cover"/>' : ''}
       </metadata>
       <manifest>
         <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
         <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
         <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
         ${
           options?.cover === true
             ? '<item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/>'
             : ''
         }
       </manifest>
       <spine>
         <itemref idref="nav"/>
         <itemref idref="ch1"/>
         <itemref idref="ch2"/>
       </spine>
     </package>`,
  );
  zip.file(
    'OEBPS/nav.xhtml',
    `<html xmlns="http://www.w3.org/1999/xhtml"><body>
       <nav><ol>
         <li><a href="ch1.xhtml">Chapter I</a></li>
         <li><a href="ch2.xhtml">Chapter II</a></li>
       </ol></nav>
     </body></html>`,
  );
  zip.file(
    'OEBPS/ch1.xhtml',
    `<html xmlns="http://www.w3.org/1999/xhtml"><body>
       <h1>The Inventor</h1>
       <p>The Time Traveller (for so it will be convenient to speak of him) was expounding a recondite matter to us.</p>
       <script>ignore this</script>
     </body></html>`,
  );
  zip.file(
    'OEBPS/ch2.xhtml',
    `<html xmlns="http://www.w3.org/1999/xhtml"><body>
       <p>I think that at that time none of us quite believed in the Time Machine.</p>
     </body></html>`,
  );
  if (options?.cover === true) {
    zip.file('OEBPS/cover.png', PIXEL, { base64: true });
  }
}

describe('parseEpub', () => {
  it('walks the spine, strips markup, and reads metadata', async () => {
    const book = await parseEpub(await epubFile('wells.epub', (zip) => standardBook(zip, { cover: true })));

    expect(book.title).toBe('The Time Machine');
    expect(book.author).toBe('H. G. Wells');
    expect(book.coverImage?.startsWith('data:image/png;base64,')).toBe(true);
    expect(book.chapters.map((chapter) => chapter.title)).toEqual(['Chapter I', 'Chapter II']);
    expect(book.chapters[0].tokens[0].text).toBe('The');
    expect(book.chapters[0].tokens.some((token) => token.text === 'ignore')).toBe(false);
    expect(book.chapters[1].tokens.map((token) => token.text).join(' ')).toContain('Time Machine');
  });

  it('rejects a damaged archive with a plain sentence', async () => {
    await expect(parseEpub(new File(['not a zip'], 'broken.epub'))).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(ImportError);
        expect((error as ImportError).message).toContain('broken.epub');
        expect((error as ImportError).message.toLowerCase()).toContain('damaged');
        return true;
      },
    );
  });

  it('rejects an EPUB that has no extractable text', async () => {
    const file = await epubFile('images.epub', (zip) => {
      zip.file(
        'META-INF/container.xml',
        `<?xml version="1.0"?>
         <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
           <rootfiles>
             <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
           </rootfiles>
         </container>`,
      );
      zip.file(
        'content.opf',
        `<?xml version="1.0"?>
         <package xmlns="http://www.idpf.org/2007/opf" unique-identifier="id" version="3.0">
           <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
             <dc:title>Pictures</dc:title>
           </metadata>
           <manifest>
             <item id="p1" href="p1.xhtml" media-type="application/xhtml+xml"/>
           </manifest>
           <spine><itemref idref="p1"/></spine>
         </package>`,
      );
      zip.file('p1.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"><body><img src="x.jpg"/></body></html>');
    });

    await expect(parseEpub(file)).rejects.toThrow('scanned images');
  });

  it('names a copy-protected book rather than calling it empty', async () => {
    const file = await epubFile('locked.epub', (zip) => {
      zip.file('META-INF/encryption.xml', '<encryption/>');
      zip.file(
        'META-INF/container.xml',
        `<?xml version="1.0"?>
         <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
           <rootfiles>
             <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
           </rootfiles>
         </container>`,
      );
      zip.file(
        'content.opf',
        `<?xml version="1.0"?>
         <package xmlns="http://www.idpf.org/2007/opf" unique-identifier="id" version="3.0">
           <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Locked</dc:title></metadata>
           <manifest><item id="p1" href="p1.xhtml" media-type="application/xhtml+xml"/></manifest>
           <spine><itemref idref="p1"/></spine>
         </package>`,
      );
      zip.file('p1.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"><body></body></html>');
    });

    await expect(parseEpub(file)).rejects.toThrow('copy-protected');
  });
});
