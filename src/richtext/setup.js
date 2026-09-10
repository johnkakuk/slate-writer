import { keymap } from 'prosemirror-keymap';
import { inputRules } from 'prosemirror-inputrules';
import { exampleSetup } from 'prosemirror-example-setup';
import { sinkListItem, liftListItem } from 'prosemirror-schema-list';
import { schema } from './markdownSerde.js';
import { markInputRules } from './markInputRules.js';
import { blankLineCleanupPlugin } from './blankLineCleanup.js';

// exampleSetup already covers input rules (# heading, - / * / + bullet list,
// 1. ordered list, > blockquote, ``` code block) and a keymap (Mod-B/Mod-I,
// Mod-[ / Mod-] for list lift/sink, Enter to split list items, undo/redo,
// etc.) — see prosemirror-example-setup. The only gap for this app is Tab /
// Shift-Tab for indenting list items, which is the more expected binding
// here (matches the screenplay editor's own Tab behavior) than Mod-[ / Mod-].
export function richTextPlugins() {
  const listItem = schema.nodes.list_item;
  const listIndentKeymap = keymap({
    Tab: sinkListItem(listItem),
    'Shift-Tab': liftListItem(listItem),
  });

  // A second, independent inputRules plugin alongside exampleSetup's own --
  // ProseMirror allows multiple, they just each check their own rules.
  const markRules = inputRules({ rules: markInputRules(schema) });

  return [listIndentKeymap, markRules, blankLineCleanupPlugin(), ...exampleSetup({ schema, menuBar: false })];
}
