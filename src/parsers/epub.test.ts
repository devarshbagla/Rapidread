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

  it('strips footnote markers and skips a table-of-contents guide entry', async () => {
    const file = await epubFile('notes.epub', (zip) => {
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
             <dc:title>Noted</dc:title>
           </metadata>
           <manifest>
             <item id="ncx2" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
             <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml"/>
             <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
           </manifest>
           <spine toc="ncx2">
             <itemref idref="toc"/>
             <itemref idref="ch1"/>
           </spine>
           <guide>
             <reference type="toc" title="Contents" href="toc.xhtml"/>
           </guide>
         </package>`,
      );
      zip.file(
        'OEBPS/toc.ncx',
        `<?xml version="1.0"?>
         <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
           <navMap>
             <navPoint id="n1"><navLabel><text>The Real Chapter</text></navLabel>
               <content src="ch1.xhtml"/></navPoint>
           </navMap>
         </ncx>`,
      );
      zip.file(
        'OEBPS/toc.xhtml',
        `<html xmlns="http://www.w3.org/1999/xhtml"><body>
           <h1>Contents</h1>
           <a href="ch1.xhtml">The Real Chapter</a>
         </body></html>`,
      );
      zip.file(
        'OEBPS/ch1.xhtml',
        `<html xmlns="http://www.w3.org/1999/xhtml"><body>
           <h1>The Real Chapter</h1>
           <p>Achilles' wrath<a href="#fn1" class="pginternal"><sup>[40]</sup></a> was terrible.</p>
           <aside epub:type="footnote" id="fn1">A later editor's note that should not be read aloud.</aside>
         </body></html>`,
      );
    });

    const book = await parseEpub(file);
    expect(book.chapters.map((chapter) => chapter.title)).toEqual(['The Real Chapter']);
    expect(book.chapters[0].tokens.map((token) => token.text)).toEqual([
      'The',
      'Real',
      'Chapter',
      "Achilles'",
      'wrath',
      'was',
      'terrible.',
    ]);
  });

  it('keeps dramatis personæ when it shares a file with a contents table', async () => {
    const file = await epubFile('play.epub', (zip) => {
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
             <dc:title>Hamlet</dc:title>
           </metadata>
           <manifest>
             <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
             <item id="front" href="front.xhtml" media-type="application/xhtml+xml"/>
             <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
           </manifest>
           <spine toc="ncx">
             <itemref idref="front"/>
             <itemref idref="ch1"/>
           </spine>
           <guide>
             <reference type="toc" title="Contents" href="front.xhtml"/>
           </guide>
         </package>`,
      );
      zip.file(
        'OEBPS/toc.ncx',
        `<?xml version="1.0"?>
         <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
           <navMap>
             <navPoint id="n0"><navLabel><text>Contents</text></navLabel>
               <content src="front.xhtml"/></navPoint>
             <navPoint id="n1"><navLabel><text>Dramatis Personæ</text></navLabel>
               <content src="front.xhtml#cast"/></navPoint>
             <navPoint id="n2"><navLabel><text>ACT I</text></navLabel>
               <content src="ch1.xhtml"/></navPoint>
           </navMap>
         </ncx>`,
      );
      zip.file(
        'OEBPS/front.xhtml',
        `<html xmlns="http://www.w3.org/1999/xhtml"><body>
           <h2>Contents</h2>
           <table>
             <tr><td>ACT I</td></tr>
             <tr><td><a href="ch1.xhtml">Scene I. Elsinore</a></td></tr>
             <tr><td><a href="ch1.xhtml#s2">Scene II. A room of state</a></td></tr>
           </table>
           <h3 id="cast">Dramatis Personæ</h3>
           <p>HAMLET, Prince of Denmark<br/>CLAUDIUS, King of Denmark</p>
         </body></html>`,
      );
      zip.file(
        'OEBPS/ch1.xhtml',
        `<html xmlns="http://www.w3.org/1999/xhtml"><body>
           <h2>ACT I</h2>
           <p>Who's there?</p>
         </body></html>`,
      );
    });

    const book = await parseEpub(file);
    expect(book.chapters.map((chapter) => chapter.title)).toEqual(['Dramatis Personæ', 'ACT I']);
    expect(book.chapters[0].tokens.map((token) => token.text)).toEqual([
      'Dramatis',
      'Personæ',
      'HAMLET,',
      'Prince',
      'of',
      'Denmark',
      'CLAUDIUS,',
      'King',
      'of',
      'Denmark',
    ]);
  });

  it('names a shared file after BOOK I rather than the volume title', async () => {
    const file = await epubFile('iliad.epub', (zip) => {
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
         <package xmlns="http://www.idpf.org/2007/opf" unique-identifier="id" version="2.0">
           <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
             <dc:title>The Iliad</dc:title>
           </metadata>
           <manifest>
             <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
             <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
           </manifest>
           <spine toc="ncx"><itemref idref="ch1"/></spine>
         </package>`,
      );
      zip.file(
        'OEBPS/toc.ncx',
        `<?xml version="1.0"?>
         <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
           <navMap>
             <navPoint id="n0"><navLabel><text>THE ILIAD.</text></navLabel>
               <content src="ch1.xhtml#title"/></navPoint>
             <navPoint id="n1"><navLabel><text>BOOK I.</text></navLabel>
               <content src="ch1.xhtml#b1"/></navPoint>
           </navMap>
         </ncx>`,
      );
      zip.file(
        'OEBPS/ch1.xhtml',
        `<html xmlns="http://www.w3.org/1999/xhtml"><body>
           <h2 id="title">THE ILIAD.</h2>
           <h2 id="b1">BOOK I.</h2>
           <p>Achilles' wrath, to Greece the direful spring.</p>
         </body></html>`,
      );
    });

    const book = await parseEpub(file);
    expect(book.chapters.map((chapter) => chapter.title)).toEqual(['BOOK I.']);
  });

  it('cuts a Gutenberg licence dumped into the last chapter', async () => {
    const file = await epubFile('licence.epub', (zip) => {
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
             <dc:title>Alice</dc:title>
           </metadata>
           <manifest>
             <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
           </manifest>
           <spine><itemref idref="ch1"/></spine>
         </package>`,
      );
      zip.file(
        'OEBPS/ch1.xhtml',
        `<html xmlns="http://www.w3.org/1999/xhtml"><body>
           <h1>CHAPTER XII</h1>
           <p>remembering her own child-life, and the happy summer days.</p>
           <h5>THE END</h5>
           <div><b>Transcriber’s Notes</b><p>Cover art is public domain.</p></div>
           <div class="pg-boilerplate pgheader footer" id="pg-footer">
             <span>*** END OF THE PROJECT GUTENBERG EBOOK ALICE ***</span>
             <div>Redistribution is subject to the trademark license.</div>
             <div id="project-gutenberg-license">START: FULL LICENSE</div>
             <h2>THE FULL PROJECT GUTENBERG LICENSE</h2>
           </div>
         </body></html>`,
      );
    });

    const book = await parseEpub(file);
    const text = book.chapters[0].tokens.map((token) => token.text).join(' ');
    expect(text).toContain('happy summer days.');
    expect(text).toContain('THE END');
    expect(text).not.toMatch(/LICENSE|Redistribution|GUTENBERG|Transcriber|public domain/i);
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
