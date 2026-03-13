'use client'

interface StepDef {
  step: number
  label: string
}

interface AudienceWizardProgressProps {
  steps: StepDef[]
  currentStep: number
}

export default function AudienceWizardProgress({ steps, currentStep }: AudienceWizardProgressProps) {
  const totalSteps = steps.length
  const currentPercent = Math.round((currentStep / totalSteps) * 100)

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-2">
        {steps.map(({ step, label }) => (
          <div
            key={step}
            className={`flex flex-col items-center flex-1 ${step <= currentStep ? 'text-primary' : 'text-gray-400'}`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 ${
                step < currentStep
                  ? 'bg-primary border-primary text-white'
                  : step === currentStep
                  ? 'border-primary bg-white text-primary'
                  : 'border-gray-300 bg-white text-gray-400'
              }`}
            >
              {step < currentStep ? '\u2713' : step}
            </div>
            <span className="mt-1 text-caption font-medium text-center">{label}</span>
          </div>
        ))}
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${currentPercent}%` }}
        />
      </div>
    </div>
  )
}
