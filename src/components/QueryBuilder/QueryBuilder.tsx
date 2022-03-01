import React, { useEffect, useContext, useRef, useState } from "react"
import { useStore } from "../../contexts/StoreProvider"
import NoExplorePlaceHolder from './NoExplorePlaceHolder'
import ExploreSelect from './ExploreSelect'
import ExploreFilter from "./ExploreFilter"
import FieldsSelect from './FieldsSelect'
import QueryPane from './QueryPane'
import { getRequiredFieldMessages, hasOrphanedSorts } from '../../services/resultsTable'
import { Button } from "@looker/components"
import { WizardContext } from "../../contexts/WizardProvider"
import { MODEL_TYPES } from "../../services/modelTypes"

type QueryBuilderProps = {
  setIsLoading: (isLoading: boolean) => void
}

export const QueryBuilder : React.FC<QueryBuilderProps> = ({ setIsLoading }) => {
  const { saveQueryToState, createAndRunQuery } = useContext(WizardContext)
  const { state, dispatch } = useStore()
  const [ requiredFieldMessages, setRequiredFieldMessages ] = useState<string[]>([])
  const { step1, step2 } = state.wizard.steps
  const firstUpdate = useRef(true)

  // re-run the query when a sort is applied
  useEffect(() => {
    // don't run on component mount
    if(firstUpdate.current) {
      firstUpdate.current = false
      return
    }
    if (!step2.ranQuery?.data) { return }
    setIsLoading(true)
    runQuery()
      .finally(() => setIsLoading(false))
  }, [step2.sorts])

  useEffect(() => {
    if (!step2.exploreData) { return }
    const messages = getRequiredFieldMessages(
      step2.exploreData?.fieldDetails,
      [...step2.selectedFields.dimensions, ...step2.selectedFields.measures],
      getRequiredFieldTypes()
    )
    setRequiredFieldMessages(messages)
  }, [step2.selectedFields, step2.exploreData])

  const runQuery = async() => {
    if (
      step2.tableHeaders &&
      hasOrphanedSorts(step2.tableHeaders, step2.sorts || [])
    ) {
      // case when a sort is applied to a column that no longer exists in the query
      // clearing the sorts will trigger another runQuery execution in the useEffect above
      dispatch({type: 'addToStepData', step: 'step2', data: { sorts: [] }})
      return
    }
    setIsLoading(true)
    const {results, exploreUrl} = await createAndRunQuery?.(step2)
    saveQueryToState?.(step2, results, exploreUrl)
    setIsLoading(false)
  }

  const getRequiredFieldTypes = () => {
    if (!step1.objective) { return [] }
    return MODEL_TYPES[step1.objective].requiredFieldTypes || []
  }

  const directoryPaneContents = step2.exploreName ?
    (<FieldsSelect/>) : (<ExploreSelect />)

  const queryPaneContents = step2.exploreName && step2.exploreData ?
    (<QueryPane/>) : (<NoExplorePlaceHolder />)

  return (
    <div>
      <div className="query-header">
        <div className="explore-filter">
          <ExploreFilter />
        </div>
        <div className="query-header-actions">
          { step2.exploreData && <>
              { getRequiredFieldTypes().length > 0 &&
                <div className="objective-requirements">
                  { requiredFieldMessages.length > 0 ? requiredFieldMessages.join(' ') : 'All field requirements met.'  }
                  <div className={`objective-requirements-indicator ${requiredFieldMessages.length > 0 ? 'warning' : 'success'}`} />
                </div>
              }
              <Button
                onClick={runQuery}
                className="action-button">
                  Run
              </Button>
            </>
          }
        </div>
      </div>
      <div className="default-layout">
        <div className="pane directory-pane">
          {directoryPaneContents}
        </div>
        <div className="pane query-pane">
          {queryPaneContents}
        </div>
      </div>
    </div>
  )
}
