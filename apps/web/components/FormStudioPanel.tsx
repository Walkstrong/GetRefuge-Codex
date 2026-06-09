import { useMemo, useState } from 'react'
import {
  Check,
  ClipboardList,
  FileText,
  LockKeyhole,
  Plus,
  Smartphone,
  Trash2,
} from 'lucide-react'

type TemplateId = 'rapid-needs' | 'shelter-assessment' | 'protection-follow-up'
type FieldKind = 'text' | 'number' | 'single_select' | 'multi_select' | 'date' | 'boolean'

type StudioField = {
  id: string
  label: string
  kind: FieldKind
  required: boolean
  options?: string[]
}

type StudioSection = {
  id: string
  title: string
  fields: StudioField[]
}

type StudioTemplate = {
  id: TemplateId
  label: string
  detail: string
  title: string
  sections: StudioSection[]
}

const FIELD_KIND_LABELS: Record<FieldKind, string> = {
  text: 'Text',
  number: 'Number',
  single_select: 'Single select',
  multi_select: 'Multi select',
  date: 'Date',
  boolean: 'Yes / No',
}

const TEMPLATES: StudioTemplate[] = [
  {
    id: 'rapid-needs',
    label: 'Rapid Needs Check',
    detail: 'Fast intake for urgent field updates',
    title: 'Rapid Needs Check',
    sections: [
      {
        id: 'household',
        title: 'Household snapshot',
        fields: [
          {
            id: 'household-size',
            label: 'Household size',
            kind: 'number',
            required: true,
          },
          {
            id: 'primary-need',
            label: 'Primary need',
            kind: 'multi_select',
            required: true,
            options: ['Food', 'Water', 'Shelter', 'Medical', 'Protection'],
          },
        ],
      },
      {
        id: 'urgency',
        title: 'Urgency',
        fields: [
          {
            id: 'severity',
            label: 'Severity level',
            kind: 'single_select',
            required: true,
            options: ['Low', 'Medium', 'High', 'Critical'],
          },
          {
            id: 'follow-up',
            label: 'Follow-up needed',
            kind: 'boolean',
            required: false,
          },
        ],
      },
    ],
  },
  {
    id: 'shelter-assessment',
    label: 'Shelter Assessment',
    detail: 'Damage and occupancy review',
    title: 'Shelter Assessment',
    sections: [
      {
        id: 'site',
        title: 'Site information',
        fields: [
          {
            id: 'shelter-type',
            label: 'Shelter type',
            kind: 'single_select',
            required: true,
            options: ['Collective centre', 'Host family', 'Tent', 'Damaged home'],
          },
          {
            id: 'occupants',
            label: 'Number of occupants',
            kind: 'number',
            required: true,
          },
        ],
      },
      {
        id: 'condition',
        title: 'Condition',
        fields: [
          {
            id: 'damage-level',
            label: 'Damage level',
            kind: 'single_select',
            required: true,
            options: ['Minor', 'Moderate', 'Severe', 'Unsafe'],
          },
          {
            id: 'weatherproof',
            label: 'Weatherproof',
            kind: 'boolean',
            required: false,
          },
        ],
      },
    ],
  },
  {
    id: 'protection-follow-up',
    label: 'Protection Follow-up',
    detail: 'Case-safe referral check',
    title: 'Protection Follow-up',
    sections: [
      {
        id: 'case-status',
        title: 'Case status',
        fields: [
          {
            id: 'age-range',
            label: 'Age range',
            kind: 'single_select',
            required: true,
            options: ['0-5', '6-12', '13-17', '18-25', '26-40', '41-60', '60+'],
          },
          {
            id: 'risk-factor',
            label: 'Risk factor observed',
            kind: 'multi_select',
            required: true,
            options: ['Child protection', 'GBV', 'Separated family', 'Legal aid'],
          },
        ],
      },
      {
        id: 'referral',
        title: 'Referral',
        fields: [
          {
            id: 'referral-made',
            label: 'Referral made',
            kind: 'boolean',
            required: true,
          },
          {
            id: 'next-check',
            label: 'Next check date',
            kind: 'date',
            required: false,
          },
        ],
      },
    ],
  },
]

const FIELD_KIND_OPTIONS = Object.entries(FIELD_KIND_LABELS) as Array<
  [FieldKind, string]
>

function supportsOptions(kind: FieldKind): boolean {
  return kind === 'single_select' || kind === 'multi_select'
}

function cloneTemplate(template: StudioTemplate): {
  title: string
  sections: StudioSection[]
} {
  return {
    title: template.title,
    sections: template.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => ({
        ...field,
        options: field.options ? [...field.options] : undefined,
      })),
    })),
  }
}

function createField(sectionId: string, index: number): StudioField {
  return {
    id: `${sectionId}-field-${Date.now()}-${index}`,
    label: 'New field',
    kind: 'text',
    required: false,
  }
}

function titleize(value: string): string {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function FieldPreview({ field }: { field: StudioField }) {
  const label = field.label.trim() || 'Untitled field'
  const requiredMarker = field.required ? ' *' : ''

  if (field.kind === 'boolean') {
    return (
      <div className="rounded-md border border-[var(--dash-warm-border)] bg-background p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-foreground">
            {label}
            {requiredMarker}
          </span>
          <span className="h-6 w-11 rounded-full border border-[var(--dash-warm-border)] bg-muted p-0.5">
            <span className="block h-4 w-4 rounded-full bg-card shadow-sm" />
          </span>
        </div>
      </div>
    )
  }

  if (supportsOptions(field.kind)) {
    return (
      <div className="rounded-md border border-[var(--dash-warm-border)] bg-background p-3">
        <p className="text-sm font-medium text-foreground">
          {label}
          {requiredMarker}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(field.options?.length ? field.options : ['Option']).map((option) => (
            <span
              key={option}
              className="rounded-full border border-[var(--dash-warm-border)] px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              {option.trim() || 'Option'}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <label className="block rounded-md border border-[var(--dash-warm-border)] bg-background p-3">
      <span className="text-sm font-medium text-foreground">
        {label}
        {requiredMarker}
      </span>
      <span className="mt-2 block rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
        {field.kind === 'date'
          ? 'dd/mm/yyyy'
          : field.kind === 'number'
            ? '0'
            : 'Enter text'}
      </span>
    </label>
  )
}

export function FormStudioPanel() {
  const initial = cloneTemplate(TEMPLATES[0])
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId>(TEMPLATES[0].id)
  const [formTitle, setFormTitle] = useState(initial.title)
  const [sections, setSections] = useState<StudioSection[]>(initial.sections)
  const [activeSectionId, setActiveSectionId] = useState(initial.sections[0]?.id ?? '')

  const selectedTemplate = TEMPLATES.find((template) => template.id === selectedTemplateId) ?? TEMPLATES[0]
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0]
  const fieldCount = useMemo(
    () => sections.reduce((sum, section) => sum + section.fields.length, 0),
    [sections],
  )

  const loadTemplate = (templateId: TemplateId) => {
    const template = TEMPLATES.find((candidate) => candidate.id === templateId) ?? TEMPLATES[0]
    const next = cloneTemplate(template)
    setSelectedTemplateId(template.id)
    setFormTitle(next.title)
    setSections(next.sections)
    setActiveSectionId(next.sections[0]?.id ?? '')
  }

  const updateSectionTitle = (sectionId: string, title: string) => {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId ? { ...section, title } : section,
      ),
    )
  }

  const updateField = (
    sectionId: string,
    fieldId: string,
    updater: (field: StudioField) => StudioField,
  ) => {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.map((field) =>
                field.id === fieldId ? updater(field) : field,
              ),
            }
          : section,
      ),
    )
  }

  const updateFieldKind = (sectionId: string, field: StudioField, kind: FieldKind) => {
    updateField(sectionId, field.id, (current) => {
      if (!supportsOptions(kind)) {
        return {
          id: current.id,
          label: current.label,
          kind,
          required: current.required,
        }
      }

      return {
        ...current,
        kind,
        options: current.options?.length ? current.options : ['Option 1', 'Option 2'],
      }
    })
  }

  const updateOption = (
    sectionId: string,
    fieldId: string,
    optionIndex: number,
    value: string,
  ) => {
    updateField(sectionId, fieldId, (field) => ({
      ...field,
      options: (field.options ?? []).map((option, index) =>
        index === optionIndex ? value : option,
      ),
    }))
  }

  const addOption = (sectionId: string, fieldId: string) => {
    updateField(sectionId, fieldId, (field) => {
      const options = field.options ?? []
      return {
        ...field,
        options: [...options, `Option ${options.length + 1}`],
      }
    })
  }

  const removeOption = (
    sectionId: string,
    fieldId: string,
    optionIndex: number,
  ) => {
    updateField(sectionId, fieldId, (field) => ({
      ...field,
      options: (field.options ?? []).filter((_, index) => index !== optionIndex),
    }))
  }

  const addField = (sectionId: string) => {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: [...section.fields, createField(section.id, section.fields.length + 1)],
            }
          : section,
      ),
    )
  }

  const removeField = (sectionId: string, fieldId: string) => {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.filter((field) => field.id !== fieldId),
            }
          : section,
      ),
    )
  }

  return (
    <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <div className="rounded-lg border border-[var(--dash-warm-border)] bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Form Studio
              </p>
              <h3 className="mt-1 text-xl font-semibold text-foreground">
                Deployable forms preview
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Local draft only. Schema sync is not enabled in this preview.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--dash-warm-border)] px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <LockKeyhole className="h-3.5 w-3.5" />
              Roadmap preview
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => loadTemplate(template.id)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  selectedTemplateId === template.id
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-[var(--dash-warm-border)] bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {template.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {template.detail}
                    </p>
                  </div>
                  {selectedTemplateId === template.id ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--dash-warm-border)] bg-card p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div>
              <div className="space-y-2">
                <label htmlFor="formTitle" className="block text-xs font-medium text-card-foreground">
                  Form title
                </label>
                <input
                  id="formTitle"
                  value={formTitle}
                  maxLength={80}
                  onChange={(event) => setFormTitle(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="mt-5 space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Sections
                </p>
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSectionId(section.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm ${
                      activeSection?.id === section.id
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-[var(--dash-warm-border)] bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <span className="min-w-0 truncate font-medium">
                      {section.title || 'Untitled section'}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {section.fields.length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {activeSection ? (
              <div className="min-w-0">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div className="space-y-2 md:max-w-sm">
                    <label htmlFor="sectionTitle" className="block text-xs font-medium text-card-foreground">
                      Section title
                    </label>
                    <input
                      id="sectionTitle"
                      value={activeSection.title}
                      maxLength={64}
                      onChange={(event) =>
                        updateSectionTitle(activeSection.id, event.target.value)
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => addField(activeSection.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--dash-warm-border)] px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    <Plus className="h-4 w-4" />
                    Add field
                  </button>
                </div>

                <div className="space-y-3">
                  {activeSection.fields.map((field) => (
                    <div
                      key={field.id}
                      className="rounded-lg border border-[var(--dash-warm-border)] bg-background p-4"
                    >
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_160px_120px_36px] lg:items-end">
                        <div className="space-y-2">
                          <label htmlFor={`${field.id}-label`} className="block text-xs font-medium text-card-foreground">
                            Field label
                          </label>
                          <input
                            id={`${field.id}-label`}
                            value={field.label}
                            maxLength={80}
                            onChange={(event) =>
                              updateField(activeSection.id, field.id, (current) => ({
                                ...current,
                                label: event.target.value,
                              }))
                            }
                            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor={`${field.id}-kind`} className="block text-xs font-medium text-card-foreground">
                            Type
                          </label>
                          <select
                            id={`${field.id}-kind`}
                            value={field.kind}
                            onChange={(event) =>
                              updateFieldKind(
                                activeSection.id,
                                field,
                                event.target.value as FieldKind,
                              )
                            }
                            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            {FIELD_KIND_OPTIONS.map(([kind, label]) => (
                              <option key={kind} value={kind}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <label className="flex h-10 items-center gap-2 rounded-md border border-[var(--dash-warm-border)] bg-card px-3 text-sm font-medium text-card-foreground">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(event) =>
                              updateField(activeSection.id, field.id, (current) => ({
                                ...current,
                                required: event.target.checked,
                              }))
                            }
                            className="h-4 w-4 rounded border-input"
                          />
                          Required
                        </label>
                        <button
                          type="button"
                          onClick={() => removeField(activeSection.id, field.id)}
                          disabled={activeSection.fields.length <= 1}
                          className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--dash-warm-border)] text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                          title="Remove field"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {supportsOptions(field.kind) ? (
                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">
                            Options
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(field.options ?? []).map((option, index) => (
                              <div
                                key={`${field.id}-${index}`}
                                className="inline-flex items-center gap-1 rounded-full border border-[var(--dash-warm-border)] bg-card px-2 py-1"
                              >
                                <input
                                  value={option}
                                  maxLength={32}
                                  onChange={(event) =>
                                    updateOption(
                                      activeSection.id,
                                      field.id,
                                      index,
                                      event.target.value,
                                    )
                                  }
                                  className="w-24 bg-transparent text-xs font-medium text-foreground outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeOption(activeSection.id, field.id, index)}
                                  disabled={(field.options ?? []).length <= 1}
                                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                                  title="Remove option"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addOption(activeSection.id, field.id)}
                              className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--dash-warm-border)] px-3 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Option
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border border-[var(--dash-warm-border)] bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Mobile preview
              </p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">
                {formTitle.trim() || 'Untitled form'}
              </h3>
            </div>
            <Smartphone className="h-5 w-5 text-primary" />
          </div>

          <div className="mt-5 rounded-[28px] border border-[var(--dash-warm-border)] bg-slate-950 p-3 shadow-xl">
            <div className="rounded-[22px] bg-background p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                    GetRefuge
                  </p>
                  <p className="text-base font-semibold text-foreground">
                    {formTitle.trim() || 'Untitled form'}
                  </p>
                </div>
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>

              <div className="space-y-4">
                {sections.map((section) => (
                  <div key={section.id}>
                    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                      {section.title || 'Untitled section'}
                    </p>
                    <div className="space-y-2">
                      {section.fields.map((field) => (
                        <FieldPreview key={field.id} field={field} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="mt-5 w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                Save encrypted report
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--dash-warm-border)] bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {selectedTemplate.label}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {fieldCount} fields across {sections.length} sections. Local draft
                only; no schema, sync, or mobile renderer changes are written.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled
            className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border border-[var(--dash-warm-border)] px-3 py-2 text-sm font-semibold text-muted-foreground opacity-70"
          >
            <LockKeyhole className="h-4 w-4" />
            Push to field app
          </button>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Roadmap preview: schema sync is not enabled yet.
          </p>
        </div>
      </aside>
    </section>
  )
}
