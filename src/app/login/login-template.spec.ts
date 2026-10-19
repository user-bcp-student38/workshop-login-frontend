import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('login message template', () => {
  const template = readFileSync(new URL('./login.component.html', import.meta.url), 'utf8');

  it('renders the conditional message using text interpolation', () => {
    expect(template).toMatch(/<div\b(?=[^>]*class="message")(?=[^>]*\*ngIf="message")[^>]*>\s*\{\{\s*message\s*\}\}\s*<\/div>/);
  });

  it('does not bind dynamic HTML', () => {
    expect(template).not.toMatch(/\[innerHTML\]/i);
  });
});
