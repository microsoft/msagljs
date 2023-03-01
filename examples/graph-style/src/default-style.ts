import type {GraphStyleSpecification} from '@msagl/renderer-webgl'

export default {
  version: 1,
  layers: [
    {
      type: 'edge',
      filter: { property: 'rank', operator: '<', value: 7 },
      strokeColor: 'rgba(0, 0, 0, 0.3)'
    },
    {
      type: 'edge',
      filter: [
        { property: 'rank', operator: '>=', value: 7 },
        { property: 'rank', operator: '<=', value: 9 },
      ],
      strokeColor: 'rgba(0, 0, 0, 0.7)'
    },
    {
      type: 'edge',
      filter: { property: 'rank', operator: '=', value: 10 },
    },
    {
      type: 'node',
      filter: { property: 'rank', operator: '<=', value: 9 },
    },
    {
      type: 'node',
      filter: { property: 'rank', operator: '=', value: 10 },
      size: {
        interpolation: 'power',
        input: 'zoom',
        inputStops: [-3, 1],
        outputStops: [8, 1],
      },
      labelSize: {
        interpolation: 'power',
        input: 'zoom',
        inputStops: [-3, 1],
        outputStops: [8, 1],
      },
    },
  ]
} as GraphStyleSpecification
