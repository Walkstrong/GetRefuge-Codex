export const aiTools = [
  {
    type: 'function',
    function: {
      name: 'filter_records',
      description:
        'Filter records by field/operator/value. Use for queries like "show all critical incidents".',
      parameters: {
        type: 'object',
        properties: {
          formType: { type: 'string', enum: ['incident', 'beneficiary', 'both'] },
          filters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                operator: {
                  type: 'string',
                  enum: [
                    'eq',
                    'neq',
                    'gt',
                    'lt',
                    'gte',
                    'lte',
                    'contains',
                    'contains_any',
                    'in',
                  ],
                },
                value: {
                  oneOf: [
                    { type: 'string' },
                    { type: 'number' },
                    { type: 'boolean' },
                    { type: 'array', items: { type: 'string' } },
                    { type: 'array', items: { type: 'number' } },
                  ],
                },
              },
              required: ['field', 'operator', 'value'],
            },
          },
          dateRange: {
            type: 'object',
            properties: {
              start: { type: 'string' },
              end: { type: 'string' },
            },
          },
        },
        required: ['formType', 'filters'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'aggregate_by',
      description:
        'Group records by a field and count/sum/avg. Use for "incidents per region", "average household size by area".',
      parameters: {
        type: 'object',
        properties: {
          formType: { type: 'string', enum: ['incident', 'beneficiary'] },
          groupField: { type: 'string' },
          operation: { type: 'string', enum: ['count', 'sum', 'avg'] },
          aggregateField: { type: 'string' },
          chartHint: { type: 'string', enum: ['bar', 'pie', 'table'] },
          filters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                operator: {
                  type: 'string',
                  enum: [
                    'eq',
                    'neq',
                    'gt',
                    'lt',
                    'gte',
                    'lte',
                    'contains',
                    'contains_any',
                    'in',
                  ],
                },
                value: {
                  oneOf: [
                    { type: 'string' },
                    { type: 'number' },
                    { type: 'boolean' },
                    { type: 'array', items: { type: 'string' } },
                    { type: 'array', items: { type: 'number' } },
                  ],
                },
              },
              required: ['field', 'operator', 'value'],
            },
          },
          dateRange: {
            type: 'object',
            properties: {
              start: { type: 'string' },
              end: { type: 'string' },
            },
          },
        },
        required: ['formType', 'groupField', 'operation'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'time_bucket_aggregate',
      description:
        'Aggregate over time buckets for trend lines. Use for "incidents per month", "weekly breakdown".',
      parameters: {
        type: 'object',
        properties: {
          formType: { type: 'string', enum: ['incident', 'beneficiary'] },
          dateField: { type: 'string' },
          bucket: { type: 'string', enum: ['day', 'week', 'month'] },
          operation: { type: 'string', enum: ['count', 'sum'] },
          aggregateField: { type: 'string' },
          filters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                operator: {
                  type: 'string',
                  enum: [
                    'eq',
                    'neq',
                    'gt',
                    'lt',
                    'gte',
                    'lte',
                    'contains',
                    'contains_any',
                    'in',
                  ],
                },
                value: {
                  oneOf: [
                    { type: 'string' },
                    { type: 'number' },
                    { type: 'boolean' },
                    { type: 'array', items: { type: 'string' } },
                    { type: 'array', items: { type: 'number' } },
                  ],
                },
              },
              required: ['field', 'operator', 'value'],
            },
          },
          dateRange: {
            type: 'object',
            properties: {
              start: { type: 'string' },
              end: { type: 'string' },
            },
          },
        },
        required: ['formType', 'dateField', 'bucket', 'operation'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rank_top_n',
      description:
        'Top-N ranking by aggregated value. Use for "top 5 regions by incident count" and "most badly affected area".',
      parameters: {
        type: 'object',
        properties: {
          formType: { type: 'string', enum: ['incident', 'beneficiary'] },
          groupField: { type: 'string' },
          n: { type: 'number' },
          operation: { type: 'string', enum: ['count', 'sum', 'avg'] },
          scoring: {
            type: 'string',
            enum: ['risk'],
            description:
              'Use risk only when the user asks for most badly affected, worst affected, or highest risk area.',
          },
          filters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                operator: {
                  type: 'string',
                  enum: [
                    'eq',
                    'neq',
                    'gt',
                    'lt',
                    'gte',
                    'lte',
                    'contains',
                    'contains_any',
                    'in',
                  ],
                },
                value: {
                  oneOf: [
                    { type: 'string' },
                    { type: 'number' },
                    { type: 'boolean' },
                    { type: 'array', items: { type: 'string' } },
                    { type: 'array', items: { type: 'number' } },
                  ],
                },
              },
              required: ['field', 'operator', 'value'],
            },
          },
          dateRange: {
            type: 'object',
            properties: {
              start: { type: 'string' },
              end: { type: 'string' },
            },
          },
        },
        required: ['formType', 'groupField', 'n', 'operation'],
      },
    },
  },
] as const
