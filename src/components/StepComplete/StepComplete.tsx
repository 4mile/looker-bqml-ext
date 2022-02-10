import React from 'react'
import { WIZARD_STEPS } from "../../constants"
import { useHistory, useParams} from 'react-router-dom'
import { Button } from '@looker/components'

type StepCompleteParams = {
  isStepComplete?: boolean
  stepNumber: number,
  stepText?: string,
  buttonText?: string,
  handleCompleteClick?: () => Promise<boolean>
}

export const StepComplete: React.FC<StepCompleteParams> = ({
  isStepComplete,
  stepNumber,
  stepText,
  buttonText,
  handleCompleteClick
}) => {
  const history = useHistory()
  const { modelNameParam } = useParams<{modelNameParam: string}>()

  const handleClick = async () => {
    if (!isStepComplete) { return }
    if (handleCompleteClick) {
      const complete = await handleCompleteClick()
      if (!complete) { return }
    }
    if (modelNameParam) {
      history.push(`/ml/${WIZARD_STEPS[`step${stepNumber + 1}`]}/${modelNameParam}`)
    } else{
      history.push(`/ml/${WIZARD_STEPS[`step${stepNumber + 1}`]}`)
    }
  }

  const btnClass = isStepComplete ? 'complete' : ''

  return (
    <>
      <p>{stepText}</p>
      <Button
        className={`wizard-next-step-btn ${btnClass}`}
        onClick={handleClick}
      >
        { buttonText || "Continue" }
      </Button>
    </>
  )
}
