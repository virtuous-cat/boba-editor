//import { linkTo } from "@storybook/addon-links";
import Editor, {
  EditorContext,
  EditorHandler,
  getAllImages,
  removeTrailingWhitespace,
  replaceImages,
} from "../src";

import { Delta } from "quill";
import React from "react";
import { action } from "@storybook/addon-actions";

const logging = require("debug")("bobapost:stories:editor");

const REMOTE_EMBEDS_URL = `https://boba-embeds.herokuapp.com/iframely`;
const LOCAL_EMBEDS_URL = `http://localhost:8061/iframely`;

const embedsUrl =
  process.env.STORYBOOK_LOCAL_EMBEDS === "true"
    ? LOCAL_EMBEDS_URL
    : REMOTE_EMBEDS_URL;

const embedFetchers = {
  fetchers: {
    getOEmbedFromUrl: (url: string) => {
      const LOAD_DELAY = 1000;
      const promise = new Promise((resolve, reject) => {
        logging(`Calling ${embedsUrl}?uri=${url}`);
        fetch(`${embedsUrl}?uri=${url}`)
          .then((response) => {
            setTimeout(() => {
              resolve(response.json());
            }, LOAD_DELAY);
          })
          .catch((error) => {
            reject(error);
          });
      });
      return promise;
    },
  },
};

export default {
  title: "Editor Preview",
  component: Editor,
};

const EditableEditorTemplate = (args: any) => {
  return (
    <EditorContext.Provider value={embedFetchers}>
      <div
        style={{
          backgroundColor: "white",
          minHeight: "10px",
          maxWidth: "500px",
          marginTop: "100px",
        }}
      >
        <Editor
          editable={args.editable ?? true}
          initialText={JSON.parse(args.initialText)}
          focusOnMount={args.focusOnMount}
          singleLine={args.singleLine}
          onTextChange={action("TextChange")}
          onIsEmptyChange={args.onIsEmptyChange || action("EmptyChange")}
          onSubmit={action("Submit")}
          forceSSR={args.forceSSR}
        />
      </div>
    </EditorContext.Provider>
  );
};

export const SimpleEditor = EditableEditorTemplate.bind({});
SimpleEditor.args = {
  initialText:
    '[{"insert":"Open RP"},{"attributes":{"header":1},"insert":"\\n"},{"insert":{"block-image":{"src":"http://www.deelay.me/1000/https://cdn.discordapp.com/attachments/443967088118333442/691486081895628830/unknown.png","width":3840,"height":2160}}}, {"attributes":{"italic":true},"insert":"You have my sword..."}]',
  focusOnMount: true,
};

SimpleEditor.story = {
  name: "simple",
};

export const EmptyCheck = () => {
  const [empty, setEmpty] = React.useState();
  EmptyCheck.args.onIsEmptyChange = setEmpty;
  return (
    <div>
      <EditableEditorTemplate {...EmptyCheck.args} />
      <div style={{ backgroundColor: "aquamarine" }}>
        Empty? {empty ? "YES" : "NO"}
      </div>
    </div>
  );
};
EmptyCheck.args = {
  ...SimpleEditor.args,
  initialText: '[{"insert":""}]',
};
export const MultiParagraph = EditableEditorTemplate.bind({});
MultiParagraph.args = {
  initialText:
    '[{"insert":"Open RP"},{"attributes":{"header":1},"insert":"\\n"},{"insert":"You have my sword...\\nBut "},{"attributes":{"link":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"},"insert":"do you know what else you have"},{"insert": "?\\n\\nMy heart.\\n\\nLorem Ipsum, fam.\\n"}]',
};

MultiParagraph.story = {
  name: "multiparagraph",
};

export const SingleLineEditor = EditableEditorTemplate.bind({});
SingleLineEditor.args = {
  initialText: '[{"insert":""}]',
  singleLine: true,
};

SingleLineEditor.story = {
  name: "single line",
};

export const LegacyImageEditor = EditableEditorTemplate.bind({});
LegacyImageEditor.args = {
  initialText:
    '[{"insert":{"image":"https://cdn.discordapp.com/attachments/443967088118333442/691486081895628830/unknown.png"}},{"insert":"\\n"}]',
  singleLine: true,
  editable: false,
};

LegacyImageEditor.story = {
  name: "legacy image",
};

export const EditorState = () => {
  const [enabled, setEnabled] = React.useState(false);
  return (
    <div>
      <div style={{ backgroundColor: "white", maxWidth: "500px" }}>
        <Editor
          editable={enabled}
          initialText={JSON.parse(
            '[{"insert":"Open RP"},{"attributes":{"header":1},"insert":"\\n"},{"insert":{"block-image":"https://cdn.discordapp.com/attachments/443967088118333442/691486081895628830/unknown.png"}}, {"attributes":{"italic":true},"insert":"You have my sword..."}]'
          )}
          onTextChange={action("TextChange")}
          onIsEmptyChange={action("EmptyChange")}
        />
      </div>
      <input
        type="button"
        onClick={(e) => {
          setEnabled(!enabled);
        }}
        value={`toggle enabled (${enabled ? "enabled" : "disabled"})`}
      />
    </div>
  );
};

EditorState.story = {
  name: "state toggle",
};

export const ImageLoading = () => {
  const [text, setText] = React.useState(
    JSON.parse(
      '[{"insert":"Open RP"},{"attributes":{"header":1},"insert":"\\n"},{"insert":{"block-image":"https://cdn.discordapp.com/attachments/443967088118333442/691486081895628830/unknown.png"}}, {"attributes":{"italic":true},"insert":"You have my sword..."}]'
    )
  );
  const [loading, setLoading] = React.useState(false);
  const [quillEditor, setEditor] = React.useState<any>(null);
  return (
    <div>
      <div style={{ backgroundColor: "white", maxWidth: "500px" }}>
        <Editor
          editable
          initialText={text}
          onTextChange={(text) => {
            setText(text);
          }}
          focusOnMount={true}
          onIsEmptyChange={action("EmptyChange")}
          onEditorCreated={(editor) => setEditor(editor)}
        />
      </div>
      <input
        type="button"
        onClick={(e) => {
          setLoading(true);
          const images = getAllImages(text);
          setTimeout(() => {
            const replacements = images.reduce((obj, image) => {
              return {
                ...obj,
                [image]:
                  "https://pbs.twimg.com/media/EY-RqiyUwAAfgzd?format=png&name=small",
              };
            }, {});
            replaceImages(text, replacements);
            console.log(text);
            setText(text);
            quillEditor.setContents(text);
            setLoading(false);
          }, 3000);
        }}
        value={`upload images`}
        disabled={loading}
      />
    </div>
  );
};

ImageLoading.story = {
  name: "image upload",
};

export const EditorFocus = () => {
  const editorRef = React.createRef<EditorHandler>();
  return (
    <>
      <div style={{ backgroundColor: "white", maxWidth: "500px" }}>
        <Editor
          handler={editorRef}
          editable={true}
          initialText={JSON.parse(
            '[{"insert":"Open RP"},{"attributes":{"header":1},"insert":"\\n"},{"insert":{"block-image":"https://cdn.discordapp.com/attachments/443967088118333442/691486081895628830/unknown.png"}}, {"attributes":{"italic":true},"insert":"You have my sword..."}]'
          )}
          onTextChange={action("TextChange")}
          onIsEmptyChange={action("EmptyChange")}
        />
      </div>
      <input
        type="button"
        onClick={(e) => {
          editorRef.current?.focus();
        }}
        value="focus"
      />
    </>
  );
};

export const ZIndex = () => {
  const editorRef = React.createRef<EditorHandler>();
  return (
    <>
      <div
        style={{
          position: "absolute",
          zIndex: 100,
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#ff00ff50",
        }}
      >
        <div style={{ backgroundColor: "white", maxWidth: "500px" }}>
          <Editor
            handler={editorRef}
            editable={true}
            initialText={JSON.parse('[{"insert":""}]')}
            onTextChange={action("TextChange")}
            onIsEmptyChange={action("EmptyChange")}
          />
        </div>
      </div>
    </>
  );
};

export const OutputTest = () => {
  const [text, setText] = React.useState(
    JSON.parse(
      '[{"insert":"This is a H1 Header"},{"attributes":{"header":1},"insert":"\\n"},{"insert":"This is a H2 Header"},{"attributes":{"header":2},"insert":"\\n"},{"insert":"This is a H3 Header"},{"attributes":{"header":3},"insert":"\\n"},{"insert":"You have my sword..."},{"attributes":{"list":"bullet"},"insert":"\\n"},{"insert":"this is a long paragraph which is used to test the right m (argin) on this type of list."},{"attributes":{"list":"bullet"},"insert":"\\n"},{"insert":"asdasd"},{"attributes":{"list":"bullet"},"insert":"\\n"},{"insert":"adsdasdas"},{"attributes":{"list":"bullet"},"insert":"\\n"},{"attributes":{"italic":true},"insert":"This is a blockquote"},{"attributes":{"blockquote":true},"insert":"\\n"},{"attributes":{"italic":true},"insert":"A beautiful blockquote"},{"attributes":{"blockquote":true},"insert":"\\n"},{"insert":"Hello look at this blockquote"},{"attributes":{"blockquote":true},"insert":"\\n"},{"insert":"This is code block"},{"attributes":{"code-block":true},"insert":"\\n"},{"insert":"And this has some "},{"attributes":{"code":true},"insert":"inline code"},{"insert":"\\n"},{"insert":"Also this one above is a single line break, while the one below is two:\\n\\nAnd here we are!\\n"},{"insert":"Image? No "},{"attributes":{"link":"www.goojdkajdslaksdjaklsdjaklsdjaskldjaskldjaslkdjaskldjaskl…kdjalskdjaksldjaslkdjalksdjalksdjaslkdjalskdjaslkdjlkgle.com"},"insert":"problem"},{"insert":"! Just pay attention to the extra empty line at the end!"},{"insert":{"block-image":{"src":"https://steamuserimages-a.akamaihd.net/ugc/793133917200500601/21BF0F2F4E7FB0BE517EAACCFF837FA1F3D113DC/?imw=1024&imh=576&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=true","spoilers":false,"width":1024,"height":576}}}]'
    )
  );
  const [quillEditor, setEditor] = React.useState<any>(null);
  return (
    <div>
      <div
        style={{ backgroundColor: "white", maxWidth: "500px" }}
        key="editor1div"
      >
        <Editor
          key="editor1"
          editable
          initialText={text}
          onTextChange={(text) => {
            setText(text);
          }}
          focusOnMount={true}
          onIsEmptyChange={action("EmptyChange")}
        />
      </div>
      <input
        type="button"
        onClick={(e) => {
          console.log(
            JSON.stringify(text.ops)
              // @ts-ignore
              .replaceAll("\\n", "\\\\n")
              .replaceAll("'", "\\'")
          );
          quillEditor?.setContents(removeTrailingWhitespace(text));
        }}
        value={`Submit`}
      />

      <div
        style={{ backgroundColor: "white", maxWidth: "500px" }}
        key="editor2div"
      >
        <Editor
          key="editor2"
          initialText={text}
          onEditorCreated={(editor) => setEditor(editor)}
        />
      </div>
    </div>
  );
};

OutputTest.story = {
  name: "outputTest",
};
