import type {GraphStyleSpecification} from '@msagl/renderer-webgl'

export default {
  "version": 1,
  "layers": [
    {
      "type": "edge",
      "filter": {
        "property": "rank",
        "operator": "<",
        "value": 0.5
      },
      "minZoom": 2,
      "opacity": {
        "interpolation": "linear",
        "input": "zoom",
        "inputStops": [
          2,
          3
        ],
        "outputStops": [
          0,
          0.3
        ]
      }
    },
    {
      "type": "edge",
      "filter": [
        {
          "property": "rank",
          "operator": ">=",
          "value": 0.5
        },
        {
          "property": "rank",
          "operator": "<=",
          "value": 1
        }
      ],
      "minZoom": 1,
      "opacity": {
        "interpolation": "linear",
        "input": "zoom",
        "inputStops": [
          1,
          2
        ],
        "outputStops": [
          0,
          0.3
        ]
      }
    },
    {
      "type": "edge",
      "filter": [
        {
          "property": "rank",
          "operator": ">=",
          "value": 1
        },
        {
          "property": "rank",
          "operator": "<=",
          "value": 1.5
        }
      ],
      "minZoom": 0,
      "opacity": {
        "interpolation": "linear",
        "input": "zoom",
        "inputStops": [
          0,
          2
        ],
        "outputStops": [
          0,
          0.7
        ]
      }
    },
    {
      "type": "edge",
      "filter": [
        {
          "property": "rank",
          "operator": ">=",
          "value": 1.5
        },
        {
          "property": "rank",
          "operator": "<=",
          "value": 2
        }
      ],
      "minZoom": -1,
      "opacity": {
        "interpolation": "linear",
        "input": "zoom",
        "inputStops": [
          -1,
          1
        ],
        "outputStops": [
          0,
          0.7
        ]
      }
    },
    {
      "type": "edge",
      "filter": {
        "property": "rank",
        "operator": ">",
        "value": 2
      }
    },
    {
      "type": "node",
      "filter": {
        "property": "rank",
        "operator": "<=",
        "value": 0.5
      },
      "minZoom": 2,
      "opacity": {
        "interpolation": "linear",
        "input": "zoom",
        "inputStops": [
          2,
          3
        ],
        "outputStops": [
          0,
          1
        ]
      }
    },
    {
      "type": "node",
      "filter": [
        {
          "property": "rank",
          "operator": ">",
          "value": 0.5
        },
        {
          "property": "rank",
          "operator": "<=",
          "value": 1
        }
      ],
      "minZoom": 1,
      "opacity": {
        "interpolation": "linear",
        "input": "zoom",
        "inputStops": [
          1,
          2
        ],
        "outputStops": [
          0,
          1
        ]
      }
    },
    {
      "type": "node",
      "filter": [
        {
          "property": "rank",
          "operator": ">",
          "value": 1
        },
        {
          "property": "rank",
          "operator": "<=",
          "value": 1.5
        }
      ],
      "minZoom": 0,
      "opacity": {
        "interpolation": "linear",
        "input": "zoom",
        "inputStops": [
          0,
          1
        ],
        "outputStops": [
          0,
          1
        ]
      }
    },
    {
      "type": "node",
      "filter": [
        {
          "property": "rank",
          "operator": ">",
          "value": 1.5
        },
        {
          "property": "rank",
          "operator": "<=",
          "value": 2
        }
      ],
      "minZoom": -1,
      "opacity": {
        "interpolation": "linear",
        "input": "zoom",
        "inputStops": [
          -1,
          0
        ],
        "outputStops": [
          0,
          1
        ]
      }
    },
    {
      "type": "node",
      "filter": [
        {
          "property": "rank",
          "operator": ">",
          "value": 2
        },
        {
          "property": "rank",
          "operator": "<=",
          "value": 2.5
        }
      ],
      "size": {
        "interpolation": "power",
        "interpolationParameters": [
          0.5
        ],
        "input": "zoom",
        "inputStops": [
          -2,
          1
        ],
        "outputStops": [
          4,
          1
        ]
      }
    },
    {
      "type": "node",
      "filter": [
        {
          "property": "rank",
          "operator": ">",
          "value": 2.5
        },
        {
          "property": "rank",
          "operator": "<=",
          "value": 3
        }
      ],
      "size": {
        "interpolation": "power",
        "interpolationParameters": [
          0.5
        ],
        "input": "zoom",
        "inputStops": [
          -4,
          1
        ],
        "outputStops": [
          16,
          1
        ]
      }
    },
    {
      "type": "node",
      "filter": {
        "property": "rank",
        "operator": ">",
        "value": 3
      },
      "size": {
        "interpolation": "power",
        "interpolationParameters": [
          0.5
        ],
        "input": "zoom",
        "inputStops": [
          -6,
          1
        ],
        "outputStops": [
          64,
          1
        ]
      }
    }
  ]
} as GraphStyleSpecification
