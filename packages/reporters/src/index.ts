import { Reporter } from './types.js';
import { TerminalReporter } from './terminal.js';
import { JsonReporter } from './json.js';
import { MarkdownReporter } from './markdown.js';
import { JunitReporter } from './junit.js';
import { HtmlReporter } from './html.js';

export * from './types.js';
export * from './terminal.js';
export * from './json.js';
export * from './markdown.js';
export * from './junit.js';
export * from './html.js';

export function createReporter(format: string = 'terminal'): Reporter {
  switch (format.toLowerCase()) {
    case 'json':
      return new JsonReporter();
    case 'markdown':
    case 'md':
      return new MarkdownReporter();
    case 'junit':
    case 'xml':
      return new JunitReporter();
    case 'html':
      return new HtmlReporter();
    case 'terminal':
    default:
      return new TerminalReporter();
  }
}
