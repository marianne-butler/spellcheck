import { Editor, Mark, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import nspell from 'nspell';

/**
 * Config & Global State
 */
const wrapperElement = document.querySelector(".wrapper");
const editorDiv = wrapperElement.querySelector('.editor');
const toggleElement = document.querySelector(".toggle input");
const languageSelectElements = document.querySelectorAll(".languages input");

let tipTapEditor;
const spells = {}; // Stores nspell instances: { key: nspellObj }
const uiState = { highlight: false, language: null };

/**
 * Spellcheck Utils
 */
const saveSpell = ({ key, aff, dic }) => spells[key] = nspell(aff, dic);
const spellCheckWord = (word) => spells[uiState.language].correct(word);
const suggestSpelling = (word) => spells[uiState.language].suggest(word);

/**
 * UI Controls
 */
const toggleHighlight = () => {
  if (uiState.language) {
    uiState.highlight = !uiState.highlight;
    toggleElement.checked = uiState.highlight;
    wrapperElement.classList.toggle("wrapper--spellcheck", uiState.highlight);
  }
};

const changeLanguage = () => {
  const selected = Array.from(languageSelectElements).find((radio) => radio.checked);
  uiState.language = selected ? selected.value : "en";
};

toggleElement.addEventListener("change", toggleHighlight); // also triggered by tiptap keyboard shortcut
languageSelectElements.forEach((radio) => radio.addEventListener("change", changeLanguage));

/**
 * Inserts select field into the DOM
 */
function appendWordSelectField(word = "", coords = {}, onSelect = () => {}) {
  const suggestions = suggestSpelling(word);

  const menu = document.getElementById('suggestions');
  if (menu) menu.remove();

  const select = document.createElement('select');
  select.id = 'suggestions';
  select.style.left = coords.left + 'px';
  select.style.top = coords.top + 'px';

  suggestions.forEach(text => {
    const option = document.createElement('option');
    option.value = text;
    option.innerText = text;
    select.appendChild(option);
  });

  const removeSelect = () => {
    document.removeEventListener('mousedown', handleOutsideClick);
    select.remove();
  };

  const handleOutsideClick = (e) => {
    if (e.target !== select) removeSelect();
  };

  select.onchange = () => {
    onSelect(select.value);
    removeSelect();
  };

  document.addEventListener('mousedown', handleOutsideClick);
  wrapperElement.appendChild(select);
}

/**
 * TIPTAP EXTENSION
 * Marks and unmarks words as the user types
 */
const CurrentWordDetector = Extension.create({
  name: 'CurrentWordDetector',

  onUpdate({ editor }) {
    const { state } = editor;
    const { $from } = state.selection;
    
    // Locate the word boundaries relative to the current paragraph
    const text = $from.parent.textContent;
    const cursorPosition = $from.parentOffset;
    
    const wordStart = text.lastIndexOf(' ', cursorPosition - 1) + 1;
    let wordEnd = text.indexOf(' ', cursorPosition);
    if (wordEnd === -1) wordEnd = text.length;    
    
    // Remove punctuation
    const currentWord = text.slice(wordStart, wordEnd).replace(/[.,!?:]/g, '');

    if (currentWord && uiState.language) {
      // Convert relative paragraph positions to absolute document positions
      const absoluteStart = $from.start() + wordStart;
      const absoluteEnd = $from.start() + wordEnd;

      const isCorrect = spellCheckWord(currentWord);

      // Apply or remove the ErrorMark based on dictionary result
      editor.chain()
        .focus()
        .setTextSelection({ from: absoluteStart, to: absoluteEnd })
        [isCorrect ? 'unsetMark' : 'setMark']('ErrorMark')
        .run();
    }

    // Prevent focus jumping
    editor.commands.setTextSelection(state.selection.from);
  },
});

/**
 * TIPTAP MARK
 */
const ErrorMark = Mark.create({
  name: 'ErrorMark',

  addKeyboardShortcuts() {
    return { 'Shift-Mod-l': toggleHighlight };
  },

  renderHTML() { return ['span', { class: 'error' }, 0]; },

  parseHTML() { return [{ tag: 'span.error' }]; },
});

/**
 * TIPTAP EDITOR
 */
tipTapEditor = new Editor({
  element: editorDiv,
  extensions: [
    StarterKit, 
    CurrentWordDetector, 
    ErrorMark,
    Placeholder.configure({ placeholder: 'Type away...' }),
  ],
  editorProps: {
    handleDOMEvents: {
      contextmenu: (view, event) => {
        const coords = { left: event.clientX, top: event.clientY };
        const pos = view.posAtCoords(coords);        
        if (!pos) return true;
        
        // Only trigger if we clicked a node containing an ErrorMark
        const node = view.state.doc.nodeAt(pos.pos);
        const mark = node?.marks.find(m => m.type.name === 'ErrorMark');

        if (mark && node.isText) {
          event.preventDefault();
          
          const $pos = view.state.doc.resolve(pos.pos);
          const start = $pos.pos - $pos.textOffset;
          const end = start + node.nodeSize;
          
          appendWordSelectField(node.text, coords, (newWord) => {
            // Replace the entire marked range with the selected suggestion
            tipTapEditor.chain()
              .focus()
              .insertContentAt({ from: start, to: end }, newWord)
              .run();
          });
          return true;
        }
        return false;
      },
    },
  },
});

/**
 * Fetches and initializes nspell dictionaries
 */
async function initSpellChecker() {
  try {
    const [affEn, dicEn, affFr, dicFr] = await Promise.all([
      fetch('https://cdn.jsdelivr.net/npm/dictionary-en/index.aff').then(res => res.text()),
      fetch('https://cdn.jsdelivr.net/npm/dictionary-en/index.dic').then(res => res.text()),
      fetch('https://cdn.jsdelivr.net/npm/dictionary-fr/index.aff').then(res => res.text()),
      fetch('https://cdn.jsdelivr.net/npm/dictionary-fr/index.dic').then(res => res.text())
    ]);

    saveSpell({ key: "en", aff: affEn, dic: dicEn });
    saveSpell({ key: "fr", aff: affFr, dic: dicFr });

    wrapperElement.setAttribute("data-dictionaries", "ready");
    uiState.language = "en";

    if (tipTapEditor) tipTapEditor.commands.focus('start');
  } catch (err) {
    console.error("Failed to load dictionaries:", err);
  }
}

// Start dictionary loading
initSpellChecker();