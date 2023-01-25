import { createSVGWindow } from "svgdom";
import { readFileSync, writeFileSync } from "node:fs";

import { parseDot } from "@msagl/parser";
import { RendererSVG } from "@msagl/renderer";

async function run() {
    const input = readFileSync(`./input.dot`, { encoding: "utf8" });
    const options = JSON.parse(
        readFileSync(`./options.json`, { encoding: "utf8" })
    );

    const window = createSVGWindow();
    const document = window.document;
    const container = document.createElement("div");

    const renderer = new RendererSVG(container);
    const graph = parseDot(input);
    renderer.setGraph(graph, options);

    const svg = renderer.getSvgString();
    console.log(svg);
    writeFileSync("./graph.svg", svg, { encoding: "utf-8" });
}

(async () => {
    try {
        await run();
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();