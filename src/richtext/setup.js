import { keymap } from 'prosemirror-keymap';
import { inputRules } from 'prosemirror-inputrules';
import { exampleSetup } from 'prosemirror-example-setup';
import { sinkListItem, liftListItem } from 'prosemirror-schema-list';
import { schema } from './markdownSerde.js';
import { markInputRules } from './markInputRules.js';
import { emptyDocPlaceholder } from './emptyDocPlaceholder.js';

// exampleSetup already covers input rules (# heading, - / * / + bullet list,
// 1. ordered list, > blockquote, ``` code block) and a keymap (Mod-B/Mod-I,
// Mod-[ / Mod-] for list lift/sink, Enter to split list items, undo/redo,
// etc.) — see prosemirror-example-setup. The only gap for this app is Tab /
// Shift-Tab for indenting list items, which is the more expected binding
// here (matches the screenplay editor's own Tab behavior) than Mod-[ / Mod-].
//
// `placeholder` is optional -- only the Add/Edit Data Type modal's template
// composer passes one (see DocTypeModal.jsx); real Character Bible / Notes
// & Research documents don't get a ghost hint on their own blank lines.
export function richTextPlugins(placeholder) {
  const listItem = schema.nodes.list_item;
  const listIndentKeymap = keymap({
    Tab: sinkListItem(listItem),
    'Shift-Tab': liftListItem(listItem),
  });

  // A second, independent inputRules plugin alongside exampleSetup's own --
  // ProseMirror allows multiple, they just each check their own rules.
  const markRules = inputRules({ rules: markInputRules(schema) });

  const plugins = [listIndentKeymap, markRules, ...exampleSetup({ schema, menuBar: false })];
  if (placeholder) plugins.push(emptyDocPlaceholder(placeholder));
  return plugins;
}
