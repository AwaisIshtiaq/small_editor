'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Loader2, Play, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CHAINABLE, getTool } from '@/lib/pdf-tools/registry'
import { PARAM_DEFAULTS, ToolOptionsInner } from '@/components/tool-options'

type Step = { id: number; slug: string; params: Record<string, unknown> }

let nextStepId = 1

/** Build a tool pipeline: each step runs on the output of the previous one. */
export function WorkflowBuilder({
  onRun,
  running,
}: {
  onRun: (steps: { type: string; params: Record<string, unknown> }[]) => void
  running: boolean
}) {
  const [steps, setSteps] = useState<Step[]>([])

  const addStep = () =>
    setSteps((prev) => [...prev, { id: nextStepId++, slug: 'rotate', params: { ...PARAM_DEFAULTS['rotate'] } }])

  const setStep = (id: number, patch: Partial<Step>) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const removeStep = (id: number) => setSteps((prev) => prev.filter((s) => s.id !== id))

  const move = (idx: number, to: number) =>
    setSteps((prev) => {
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(idx, 1)
      next.splice(to, 0, moved)
      return next
    })

  return (
    <div className="space-y-3">
      {steps.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No steps yet. Add tools below — each step processes the output of the previous one.
        </p>
      ) : null}

      {steps.map((step, idx) => (
        <div key={step.id} className="space-y-3 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary text-primary-foreground/70">
              Step {idx + 1}
            </span>
            <div className="flex-1">
              <Label className="sr-only" htmlFor={`wf-tool-${step.id}`}>
                Tool for step {idx + 1}
              </Label>
              <Select value={step.slug} onValueChange={(slug) => setStep(step.id, { slug, params: { ...PARAM_DEFAULTS[slug] } })}>
                <SelectTrigger id={`wf-tool-${step.id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHAINABLE.map((slug) => (
                    <SelectItem key={slug} value={slug}>
                      {getTool(slug)?.name ?? slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Move step up"
              disabled={idx === 0}
              onClick={() => move(idx, idx - 1)}
            >
              <ArrowUp className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Move step down"
              disabled={idx === steps.length - 1}
              onClick={() => move(idx, idx + 1)}
            >
              <ArrowDown className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove step ${idx + 1}`}
              onClick={() => removeStep(step.id)}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <ToolOptionsInner
            slug={step.slug}
            value={step.params}
            onChange={(params) => setStep(step.id, { params })}
          />
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addStep}>
          <Plus className="size-4" aria-hidden="true" />
          Add step
        </Button>
        <Button
          onClick={() => onRun(steps.map((s) => ({ type: s.slug, params: s.params })))}
          disabled={running || steps.length === 0}
        >
          {running ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="size-4" aria-hidden="true" />
          )}
          Run workflow
        </Button>
      </div>
    </div>
  )
}
