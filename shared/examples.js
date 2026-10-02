export const examples = [
  {
    id: "english",
    label: "Reel with an English voice",
    description:
      "Two scenes with English narration. Local voice, no API key needed.",
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
    label: "Your first reel",
    description:
      "Three scenes of text and color. Works without any external service.",
    movie: {
      name: "Your ideas. In motion.",
      resolution: "hd",
      "aspect-ratio": "9:16",
      fps: 30,
      variables: { brand: "STUDIO" },
      scenes: [
        {
          name: "Intro",
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
              text: "Your ideas.\nIn motion.",
              color: "#182019",
              "font-size": 88,
            },
            {
              type: "text",
              text: "Every video starts with an idea.",
              color: "#182019",
              "font-size": 27,
              y: 1080,
            },
          ],
        },
        {
          name: "Story",
          duration: 3,
          "background-color": "#20282c",
          elements: [
            {
              type: "text",
              text: "Write JSON.\nMake video.",
              color: "#c6f36b",
              "font-size": 82,
            },
            {
              type: "text",
              text: "Scenes. Text. Sound. Story.",
              color: "#ffffff",
              "font-size": 27,
              y: 1080,
            },
          ],
        },
        {
          name: "Outro",
          duration: 3,
          "background-color": "#eceae5",
          elements: [
            {
              type: "text",
              text: "From idea\nto play.",
              color: "#182019",
              "font-size": 90,
            },
            {
              type: "text",
              text: "Made with Json2vid",
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
    label: "Landscape announcement",
    description: "A short message in 16:9 for YouTube.",
    movie: {
      name: "A fresh start",
      resolution: "hd",
      "aspect-ratio": "16:9",
      scenes: [
        {
          duration: 5,
          "background-color": "#20282c",
          elements: [
            {
              type: "text",
              text: "What comes next starts here.",
              "font-size": 64,
              color: "#c6f36b",
            },
            {
              type: "text",
              text: "Replace this text with your own message.",
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
    label: "Square quote",
    description: "Text and variables for posts generated from Sheets.",
    movie: {
      name: "Quote of the day",
      resolution: "hd",
      "aspect-ratio": "1:1",
      variables: {
        quote: "Big things start\nwith one small step.",
        author: "Thought of the day",
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
