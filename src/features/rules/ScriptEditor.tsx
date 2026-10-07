import { StreamLanguage } from '@codemirror/language'
import { csharp } from '@codemirror/legacy-modes/mode/clike'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'

const language = StreamLanguage.define(csharp)

const theme = EditorView.theme(
  {
    '&': { backgroundColor: 'transparent', fontSize: '13px' },
    '.cm-content': { fontFamily: 'var(--font-mono)', padding: '12px 0' },
    '.cm-gutters': { backgroundColor: 'transparent', borderRight: '1px solid rgb(148 163 184 / 0.1)', color: '#5b6b88' },
    '.cm-activeLine': { backgroundColor: 'rgb(255 255 255 / 0.03)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#b8c3d6' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { lineHeight: '1.65' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'rgb(34 211 238 / 0.22) !important' },
    '.cm-cursor': { borderLeftColor: '#22d3ee' },
  },
  { dark: true },
)

/** C# sözdizimi vurgulamalı script editörü (Rule Engine scriptleri C# benzeri). */
export default function ScriptEditor({
  value,
  onChange,
  height = '460px',
}: {
  value: string
  onChange: (value: string) => void
  height?: string
}) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      height={height}
      theme="dark"
      extensions={[language, theme, EditorView.lineWrapping]}
      basicSetup={{ foldGutter: false, highlightActiveLine: true, autocompletion: true }}
    />
  )
}
