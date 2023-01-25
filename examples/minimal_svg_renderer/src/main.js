"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parser_1 = require("@msagl/parser");
const renderer_1 = require("@msagl/renderer");
const renderer = new renderer_1.RendererSvg();
const graph = (0, parser_1.parseDot)(`
graph G {
	kspacey -- swilliams;
	swilliams -- kbacon;
	bpitt -- kbacon;
	hford -- lwilson;
	lwilson -- kbacon;
}`);
renderer.setGraph(graph);
