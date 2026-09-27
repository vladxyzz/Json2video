export const examples = [
  {
    id: "english",
    label: "Reel cu voce în engleză",
    description:
      "Două scene și narațiune în engleză. Voce locală, fără cheie API.",
    movie: {
      name: "Small steps. Big ideas.",
      resolution: "hd",
      "aspect-ratio": "9:16",
      scenes: [
        {
          name: "Opening",
          duration: 6,
          "background-color": "#c6f36b",
          elements: [
            {
              type: "text",
              text: "Small steps.\nBig ideas.",
              "font-size": 82,
              color: "#182019",
            },
            {
              type: "voice",
              provider: "local",
              language: "en-US",
              text: "Every great idea starts with a small step. Make yours today.",
            },
          ],
        },
        {
          name: "Closing",
          duration: 6,
          "background-color": "#20282c",
          elements: [
            {
              type: "text",
              text: "Create.\nShare.\nRepeat.",
              "font-size": 90,
              color: "#c6f36b",
            },
            {
              type: "voice",
              provider: "local",
              language: "en-US",
              text: "Turn your ideas into stories. Create, share, and keep moving forward.",
            },
          ],
        },
      ],
    },
  },
  {
    id: "manifest",
    label: "Primul tău reel",
    description:
      "Trei scene, text și culori. Funcționează fără servicii externe.",
    movie: {
      name: "Ideile tale. În mișcare.",
      resolution: "hd",
      "aspect-ratio": "9:16",
      fps: 30,
      variables: { brand: "STUDIO" },
      scenes: [
        {
          name: "Introducere",
          duration: 3,
          "background-color": "#c6f36b",
          elements: [
            {
              type: "text",
              text: "{{brand}} / 001",
              color: "#182019",
              "font-size": 24,
              y: 160,
            },
            {
              type: "text",
              text: "Ideile tale.\nÎn mișcare.",
              color: "#182019",
              "font-size": 88,
            },
            {
              type: "text",
              text: "Un video începe cu o idee.",
              color: "#182019",
              "font-size": 27,
              y: 1080,
            },
          ],
        },
        {
          name: "Poveste",
          duration: 3,
          "background-color": "#20282c",
          elements: [
            {
              type: "text",
              text: "Scrii JSON.\nCreezi video.",
              color: "#c6f36b",
              "font-size": 82,
            },
            {
              type: "text",
              text: "Scene. Text. Sunet. Poveste.",
              color: "#ffffff",
              "font-size": 27,
              y: 1080,
            },
          ],
        },
        {
          name: "Final",
          duration: 3,
          "background-color": "#eceae5",
          elements: [
            {
              type: "text",
              text: "De la idee\nla play.",
              color: "#182019",
              "font-size": 90,
            },
            {
              type: "text",
              text: "Creat cu Json2vid",
              color: "#46554a",
              "font-size": 26,
              y: 1080,
            },
          ],
        },
      ],
    },
  },
  {
    id: "landscape",
    label: "Anunț landscape",
    description: "Un mesaj scurt, format 16:9 pentru YouTube.",
    movie: {
      name: "Un nou început",
      resolution: "hd",
      "aspect-ratio": "16:9",
      scenes: [
        {
          duration: 5,
          "background-color": "#20282c",
          elements: [
            {
              type: "text",
              text: "Ce urmează începe aici.",
              "font-size": 64,
              color: "#c6f36b",
            },
            {
              type: "text",
              text: "Schimbă acest text cu mesajul tău.",
              "font-size": 26,
              y: 500,
            },
          ],
        },
      ],
    },
  },
  {
    id: "square",
    label: "Citat pătrat",
    description: "Text și variabile pentru postări generate din Sheets.",
    movie: {
      name: "Citatul zilei",
      resolution: "hd",
      "aspect-ratio": "1:1",
      variables: {
        quote: "Lucrurile mari încep\ncu un pas mic.",
        author: "Gândul zilei",
      },
      scenes: [
        {
          duration: 6,
          "background-color": "#d5e3ef",
          elements: [
            {
              type: "text",
              text: "{{quote}}",
              "font-size": 76,
              color: "#1e3449",
            },
            {
              type: "text",
              text: "{{author}}",
              "font-size": 28,
              color: "#1e3449",
              y: 1000,
            },
          ],
        },
      ],
    },
  },
];
