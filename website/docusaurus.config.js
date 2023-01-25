// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion
const { configure } = require("@rise4fun/docusaurus-plugin-rise4fun");
const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

const config = configure({
  title: 'MSAGL.js',
  tagline: 'Automatic Graph Layout for JavaScript',
  url: 'https://microsoft.github.io',
  baseUrl: '/msagljs',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/logo.svg',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'microsoft', // Usually your GitHub org/user name.
  projectName: 'msagljs', // Usually your repo name.

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'MSAGL.js',
        logo: {
          alt: 'Microsoft Automatic Graph Layout for JavaScript',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'doc',
            docId: 'intro',
            position: 'left',
            label: 'Docs',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Introducation',
                to: '/docs/intro',
              },
            ],
          },
        ],
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
}, {
  compileCode: {
    langs: [{
      lang: "ts",
      meta: "build",
      nodeBin: "tsc",
      npmPackage: "typescript",
      ignoreErrors: true
    }]
  },
  sideEditor: {
    editors: [
      {
        id: "dot",
        type: "iframe",
        language: "plaintext",
        lightUrl: "./editors/msagl.html?theme=light",
        darkUrl: "./editors/msagl.html?theme=dark",
        message: {
          type: "msagl",
        },
        messageTextFieldName: "dot",
        readyMessage: {
          type: "msagl",
          state: "ready",
        },
      },
    ]
  }
})

module.exports = config;
