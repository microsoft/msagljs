import type {GraphStyleSpecification} from '@msagl/renderer-webgl'

export default {
  version: 1,
  layers: [
    {
      type: 'edge',
      filter: { property: 'rank', operator: '<', value: 0.6 },
      strokeColor: 'rgba(0, 0, 0, 0.3)'
    },
    {
      type: 'edge',
      filter: [
        { property: 'rank', operator: '>=', value: 0.6 },
        { property: 'rank', operator: '<=', value: 0.9 },
      ],
      strokeColor: 'rgba(0, 0, 0, 0.7)'
    },
    {
      type: 'edge',
      filter: { property: 'rank', operator: '>', value: 0.9 },
    },
    {
      type: 'node',
      filter: { property: 'rank', operator: '<=', value: 0.99 },
    },
    {
      type: 'node',
      filter: [
        { property: 'rank', operator: '>', value: 0.99 },
        { property: 'rank', operator: '<=', value: 0.995 }
      ],
      size: {
        interpolation: 'power',
        interpolationParameters: [0.5],
        input: 'zoom',
        inputStops: [-3, 1],
        outputStops: [8, 1],
      },
      labelSize: {
        interpolation: 'power',
        interpolationParameters: [0.5],
        input: 'zoom',
        inputStops: [-3, 1],
        outputStops: [8, 1],
      },
    },
    {
      type: 'node',
      filter: { property: 'rank', operator: '>', value: 0.995 },
      size: {
        interpolation: 'power',
        interpolationParameters: [0.5],
        input: 'zoom',
        inputStops: [-5, 1],
        outputStops: [32, 1],
      },
      labelSize: {
        interpolation: 'power',
        interpolationParameters: [0.5],
        input: 'zoom',
        inputStops: [-5, 1],
        outputStops: [32, 1],
      },
    },
  ]
} as GraphStyleSpecification
