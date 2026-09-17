# msagl-js

![Test Status](https://github.com/microsoft/msagljs/workflows/Test%20Status/badge.svg?branch=master)

`MSAGLJS` is a JavaScript implementation of advanced graph layout algorithms.

- [Read the documentation](https://microsoft.github.io/msagljs/)

## Agent Skill

The repository includes an open-standard `msagljs` Agent Skill for AI coding
agents that need to:

- compute graph layouts and routed edge geometry
- embed live SVG or WebGL network visualizations in web pages
- load DOT, JSON, JGF, and delimited edge-list data
- export network figures as SVG, PDF, PNG, EPS, or PostScript
- add generated vector figures to LaTeX documents

With GitHub CLI 2.90 or later, inspect and install the current development
version:

```bash
gh skill preview microsoft/msagljs msagljs@dev
gh skill install microsoft/msagljs msagljs@dev --agent github-copilot --scope project
```

Use `--scope user` to make the skill available across projects, or select
another supported host with `--agent`. In an active Copilot CLI session, run
`/skills reload` after installation and `/skills info msagljs` to inspect it.
You can force activation with a prompt such as:

```text
Use the /msagljs skill to embed this network in the page.
```

Installed agents match prompts against the skill's name and description, then
load its detailed references and scripts only when needed. After this skill is
merged to the default branch, it can also be found through:

```bash
gh skill search msagljs --owner microsoft
gh skill search "graph layout" --owner microsoft
```

GitHub Code Search indexes only the default branch, so direct `@dev`
preview/install commands are required before the skill reaches `main`.

## [Contributing](./CONTRIBUTING.md)

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft
trademarks or logos is subject to and must follow
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.
Any use of third-party trademarks or logos are subject to those third-party's policies.
