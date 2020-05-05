import React, { Component, createRef, forwardRef } from "react";
import classNames from "classnames";
import {
  detectNewLine,
  withKeyboardSubmitHandler,
  withNoLinebreakHandler,
  removeLineBreaksFromPaste,
} from "./quillUtils";
import Tooltip from "./Tooltip";
import Spinner from "./Spinner";

import "quill/dist/quill.bubble.css";
import "react-tenor/dist/styles.css";

const logging = require("debug")("bobapost:editor");
const loggingVerbose = require("debug")("bobapost:editor:verbose");

// logging.enabled = true;
// loggingVerbose.enabled = true;

// Only import Quill if there is a "window".
// This allows the editor to be imported even in a SSR environment.
// But also, let's add the type declaration regardless so TS won't
// complain.
// (This won't work without typescript 3.8.
// See: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html#-type-only-imports-and-export
// And so we wait...)
// Also follow: https://github.com/zeit/next.js/issues/11196
//import type Quill from "quill";
import Quill from "./quill";
import Delta from "quill-delta";

let QuillModule: typeof Quill;
if (typeof window !== "undefined") {
  QuillModule = require("quill") as typeof Quill;

  const MagicUrl = require("quill-magic-url");
  QuillModule.register("modules/magicUrl", MagicUrl.default);

  // Add New Quill Types
  const TweetEmbed = require("./custom-nodes/TweetEmbed");
  QuillModule.register("formats/tweet", TweetEmbed.default);

  const BlockImage = require("./custom-nodes/BlockImage");
  QuillModule.register(BlockImage.default);
}

class Editor extends Component<Props> {
  state = {
    // QuillJS "empty state" still has one character.
    charactersTyped: 1,
    showTooltip: false,
    loaded: false,
  };

  editor: Quill = null;
  editorContainer = createRef<HTMLDivElement>();
  tooltip = createRef<HTMLDivElement>();
  toolbarContainer = createRef<HTMLDivElement>();

  skipTooltipUpdates = false;

  // Array of event handlers. Event handlers should be added here so
  // they can be unlinked when the component unmounts.
  eventHandlers: Array<{
    type: "text-change" | "selection-change" | "editor-change";
    handler: any;
  }> = [];
  removeLineBreaksHandler = null;

  // Adds handler that checks how many characters have been typed
  // and updates parents when editor is empty.
  addCharactersTypedHandler() {
    const typingHandler = this.editor.on("text-change" as const, (delta) => {
      const currentCharacters = this.editor.getLength();
      const stateCharacters = this.state.charactersTyped;
      logging(
        `Text changed: ${currentCharacters}(current) ${stateCharacters}(previous)`
      );
      this.setState({ charactersTyped: currentCharacters }, () => {
        // We're only updating if the number of characters effectively changed
        // as it's possible for "text formatting" changes to also trigger
        // this callback and we don't want to continuously do so.
        if (this.props.onIsEmptyChange) {
          if (stateCharacters == 1 && currentCharacters > 1) {
            loggingVerbose("Marking not empty");
            this.props.onIsEmptyChange(false);
          } else if (stateCharacters > 1 && currentCharacters == 1) {
            loggingVerbose("Marking empty");
            this.props.onIsEmptyChange(true);
          }
        }
        if (this.props.onCharactersChange) {
          if (stateCharacters != currentCharacters) {
            loggingVerbose("Updating character count");
            this.props.onCharactersChange(currentCharacters);
          }
        }
      });
    });

    this.eventHandlers.push({
      type: "text-change" as const,
      handler: typingHandler,
    });
  }

  // Adds handler that detects when the cursor is moved to a new line and
  // shows a tooltip.
  addEmptyLineTooltipHandler() {
    const newLineHandler = this.editor.on(
      "editor-change",
      (eventName, ...args) => {
        if (eventName === "selection-change") {
          if (!this.props.editable) {
            return;
          }
          const bounds = detectNewLine(this.editor);
          this.maybeShowEmptyLineTooltip(bounds);
          this.props.onTextChange(this.editor.getContents());
        }
      }
    );
    this.eventHandlers.push({
      type: "editor-change" as const,
      handler: newLineHandler,
    });

    QuillModule.import("formats/block-image").setOnLoadCallback(() => {
      this.skipTooltipUpdates = false;
      const bounds = detectNewLine(this.editor);
      this.maybeShowEmptyLineTooltip(bounds);
    });
    QuillModule.import("formats/tweet").setOnLoadCallback(() => {
      this.skipTooltipUpdates = false;
      const bounds = detectNewLine(this.editor);
      this.maybeShowEmptyLineTooltip(bounds);
    });
  }

  addRemoveLinebreaksOnPasteHandler() {
    this.removeLineBreaksHandler = this.editorContainer.current.addEventListener(
      "paste",
      removeLineBreaksFromPaste,
      true
    );
  }

  maybeShowEmptyLineTooltip(bounds) {
    if (this.tooltip?.current == null || this.skipTooltipUpdates) {
      return;
    }
    if (bounds == null) {
      this.setState({ showTooltip: false });
      return;
    }
    logging("Showing tooltip");
    this.setState({ showTooltip: true });
    // TODO: pass position to tooltip instead.
    this.tooltip.current.style.top = bounds.top + "px";
    this.tooltip.current.style.right = bounds.right + "px";
  }

  shouldComponentUpdate(newProps, newState) {
    loggingVerbose("Should I update?");
    let update = false;
    update = update || newProps.editable != this.props.editable;
    update = update || newState.showTooltip != this.state.showTooltip;
    update = update || newState.loaded != this.state.loaded;
    update = update || newProps.focus != this.props.focus;
    loggingVerbose(update ? "...yes." : "...no.");
    return update;
  }

  componentDidUpdate(prevProps) {
    this.editor.enable(this.props.editable);
    if (!this.props.editable) {
      this.setState({ showTooltip: false });
    }

    if (this.props.focus && !prevProps.focus) {
      this.editor.focus();
    }
  }

  componentDidMount() {
    logging("Installing Quill Editor");
    const quillConfig = {
      modules: {
        toolbar: {
          container: this.toolbarContainer.current,
        },
        clipboard: {
          matchVisual: false,
        },
        magicUrl: {
          normalizeUrlOptions: {
            stripProtocol: true,
          },
        },
        keyboard: {
          bindings: {},
        },
      },
      theme: "bubble",
    };

    withKeyboardSubmitHandler(quillConfig.modules.keyboard, () => {
      logging("submitting via keyboard...");
      if (this.props.editable) {
        this.props.onTextChange(this.editor.getContents());
        this.props.onSubmit();
      }
    });

    if (this.props.singleLine) {
      logging("adding no linebreak handler...");
      withNoLinebreakHandler(quillConfig.modules.keyboard);
    }

    this.editor = new QuillModule(this.editorContainer.current, quillConfig);

    // Add handlers
    this.addCharactersTypedHandler();
    this.addEmptyLineTooltipHandler();
    if (this.props.singleLine) {
    }

    // Set initial state
    this.editor.enable(this.props.editable);
    console.log(this.props.initialText);
    if (this.props.initialText) {
      this.editor.setContents(this.props.initialText);
    }

    if (this.props.focus) {
      this.editor.focus();
    }

    // Initialize characters counts (if handlers attached)
    this.props.onIsEmptyChange &&
      this.props.onIsEmptyChange(this.editor.getLength() == 1);
    this.props.onCharactersChange &&
      this.props.onCharactersChange(this.editor.getLength());
    this.setState({ loaded: true });
    if (logging.enabled) {
      // Save this editor for easy debug access.
      window["editor"] = this.editor;
    }
  }

  componentWillUnmount() {
    logging("Unmounting editor");
    this.eventHandlers.forEach((handler) => {
      logging("Removing handler", handler);
      this.editor.off(handler.type as any, handler.handler);
    });

    if (this.removeLineBreaksHandler) {
      this.editorContainer.current.removeEventListener(
        "paste",
        this.removeLineBreaksHandler
      );
    }
  }

  render() {
    return (
      <>
        <div className={classNames("editor", { loaded: this.state.loaded })}>
          <div className="spinner">
            <Spinner />
          </div>
          <Toolbar ref={this.toolbarContainer} loaded={this.state.loaded} />
          <Tooltip
            ref={this.tooltip}
            onInsertEmbed={({ type, embed }) => {
              this.editor.focus();
              this.skipTooltipUpdates = true;
              const range = this.editor.getSelection(true);
              // TODO: remove empty line before inserting image?
              this.editor.insertEmbed(range.index, type, embed, "user");
              this.editor.setSelection((range.index + 1) as any, "silent");
            }}
            show={this.state.showTooltip && this.props.showTooltip != false}
            preventUpdate={(shouldPrevent) => {
              this.skipTooltipUpdates = shouldPrevent;
            }}
          />
          <div
            className={classNames("editor-quill", {
              "view-only": !this.props.editable,
            })}
            ref={this.editorContainer}
          ></div>
        </div>

        <style jsx>{`
          .editor,
          .editor-quill,
          .editor-quill,
          .editor :global(.ql-editor) {
            min-height: inherit;
          }
          .editor {
            position: relative;
            height: 100%;
          }
          .editor-quill {
            flex-grow: 1;
            font-size: medium;
          }
          .loaded .spinner {
            display: none;
          }
          .spinner {
            text-align: center;
          }
          .editor-quill.view-only :global(.ql-editor) > :global(*) {
            cursor: auto !important;
          }
          .editor :global(.ql-editor) {
            overflow: visible;
            height: 100%;
            padding: 0;
          }
          .editor-quill :global(.ql-tooltip) {
            z-index: 5;
          }
          .editor :global(.ql-container) :global(a) {
            white-space: normal !important;
          }
        `}</style>
        {/* Add global styles for types*/}
        <style jsx>{`
          :global(.tweet.error) {
            width: 100%;
            height: 50px;
            background-color: red;
            border-radius: 5px;
            text-align: center;
            line-height: 50px;
            color: white;
            margin: 10px 0;
          }
          :global(.tweet.loading) {
            width: 100%;
            height: 50px;
            background-color: gray;
            margin: 10px 0;
            text-align: center;
            line-height: 50px;
            color: white;
          }
          :global(.ql-block-image) {
            text-align: center;
            margin: 10px 0;
          }
        `}</style>
      </>
    );
  }
}

const Toolbar = forwardRef<HTMLDivElement, { loaded: boolean }>(
  ({ loaded }, ref) => {
    return (
      <>
        <div
          className={classNames("toolbar", "ql-toolbar", { loaded })}
          ref={ref}
        >
          <span className="ql-formats">
            <button className="ql-bold"></button>
            <button className="ql-italic"></button>
            <button className="ql-underline"></button>
            <button className="ql-strike"></button>
            <button className="ql-link"></button>
          </span>
          <span className="ql-formats">
            <select className="ql-header">
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="">Normal</option>
            </select>
          </span>
        </div>
        <style jsx>{`
          .toolbar {
            display: none;
          }
          .toolbar.loaded {
            display: block;
          }
        `}</style>
      </>
    );
  }
);

interface Props {
  editable: boolean;
  focus: boolean;
  initialText: Delta;
  // Note: this prop cannot be changed after initialization.
  singleLine?: boolean;
  showTooltip?: boolean;
  onTextChange: (_: Delta) => void;
  onIsEmptyChange?: (empty: boolean) => void;
  onCharactersChange?: (_: number) => void;
  onSubmit: () => void;
}

export default Editor;