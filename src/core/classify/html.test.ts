import { describe, expect, it } from 'vitest';
import { htmlToText } from './index.ts';

describe('htmlToText', () => {
  it('turns list items into bullet lines and paragraphs into line breaks', () => {
    const out = htmlToText('<p>Requirements</p><ul><li>Excel</li><li>SQL <b>basics</b></li></ul><p>Apply now</p>');
    expect(out).toBe('Requirements\n• Excel\n• SQL basics\nApply now');
  });

  it('decodes double-escaped Greenhouse content', () => {
    const out = htmlToText('&lt;p&gt;Join our team &amp;amp; grow&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Learn SQL&lt;/li&gt;&lt;/ul&gt;');
    expect(out).toBe('Join our team & grow\n• Learn SQL');
  });

  it('decodes named and numeric entities', () => {
    expect(htmlToText('R&amp;D &ndash; Q&#39;s &#x2014; caf&eacute;&nbsp;hours &lt;3 days')).toBe('R&D – Q\'s — café hours <3 days');
  });

  it('removes scripts, styles and comments, and converts br/headings to newlines', () => {
    const out = htmlToText(
      '<style>.a{color:red}</style><h2>About us</h2>Line one<br/>Line two<script>alert(1)</script><!-- hidden --><div>Done</div>',
    );
    expect(out).toBe('About us\nLine one\nLine two\nDone');
  });

  it('collapses runs of whitespace and blank lines but keeps line breaks', () => {
    const out = htmlToText('<p>A   lot\t of    space</p>\n\n\n\n<p>Next</p>');
    expect(out).toBe('A lot of space\nNext');
  });

  it('keeps a bullet attached to nested paragraph content', () => {
    expect(htmlToText('<ul><li><p>Nested text</p></li><li></li></ul>')).toBe('• Nested text');
  });

  it('leaves plain text with a literal less-than sign alone', () => {
    expect(htmlToText('GPA < 3.0 will not be considered')).toBe('GPA < 3.0 will not be considered');
  });
});
