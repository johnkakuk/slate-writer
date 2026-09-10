import { InputRule } from 'prosemirror-inputrules';

// prosemirror-example-setup's buildInputRules only covers block-level
// patterns (heading, list, blockquote, code block) -- it has no equivalent
// for inline marks, so **bold**/*italic*/`code` typed as literal markdown
// shorthand wouldn't auto-format without these.
function markInputRule(regex, markType) {
  return new InputRule(regex, (state, match, start, end) => {
    const innerText = match[1];
    if (!innerText) return null;
    const tr = state.tr;
    tr.replaceWith(start, end, state.schema.text(innerText));
    tr.addMark(start, start + innerText.length, markType.create());
    tr.removeStoredMark(markType);
    return tr;
  });
}

export function markInputRules(schema) {
  const rules = [];
  if (schema.marks.strong) {
    rules.push(markInputRule(/(?<!\*)\*\*([^*]+)\*\*$/, schema.marks.strong));
    rules.push(markInputRule(/(?<!_)__([^_]+)__$/, schema.marks.strong));
  }
  if (schema.marks.em) {
    rules.push(markInputRule(/(?<!\*)\*([^*]+)\*$/, schema.marks.em));
    rules.push(markInputRule(/(?<!_)_([^_]+)_$/, schema.marks.em));
  }
  if (schema.marks.code) {
    rules.push(markInputRule(/(?<!`)`([^`]+)`$/, schema.marks.code));
  }
  return rules;
}
