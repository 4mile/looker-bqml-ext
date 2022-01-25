import React, {useEffect} from 'react'
import { getHeaderColumns, findSortedHeader } from '../../../services/resultsTable'
import { useStore } from '../../../contexts/StoreProvider'
import { ResultsTableHeaderItem } from '../../../types'
import { ResultsTableHeaders } from './ResultsTableHeaders'
import { without, compact } from 'lodash'
import { ResultsTableRows } from './ResultsTableRows'
import { DESC_STRING } from '../../../constants'
import Spinner from '../../Spinner'


export const ResultsTable: React.FC = () => {
  const { state, dispatch } = useStore()
  const { selectedFields, exploreData, ranQuery, sorts, tableHeaders } = state.wizard.steps.step2

  useEffect(() => {
    const headers = getHeaderColumns(
      selectedFields,
      ranQuery,
      exploreData
    )
    dispatch({ type: 'addToStepData', step: 'step2', data: { tableHeaders: headers } })
  }, [
    selectedFields.dimensions,
    selectedFields.measures,
    ranQuery
  ])

  const onHeaderClick = (e: any, header: ResultsTableHeaderItem) => {
    if (!ranQuery?.data) { return }
    let newSort: string | null = header.name || null
    const sortedHeader = findSortedHeader(sorts, header)

    if (sortedHeader) {
      const isASC = sortedHeader?.indexOf(DESC_STRING) < 0
      if (!isASC) {
        // clicking on a desc sorted column will remove the sort
        newSort = null
      } else {
        // flip sort to desc
        newSort = `${header.name} desc`
      }
    }

    const isShiftPressed = e.shiftKey
    const rawSorts = isShiftPressed
      ? [...without(sorts, sortedHeader), newSort]
      : [newSort]
    // remove any null'd out sorts (which happens when toggling back to default state)
    dispatch({ type: 'addToStepData', step: 'step2', data: { sorts: compact(rawSorts) }})
  }

  return (
    <div className="results-table-container">
      <div className="results-table">
        <table>
          <ResultsTableHeaders
            headers={tableHeaders}
            onHeaderClick={onHeaderClick}
            sorts={sorts}
          />
          <tbody>
            <ResultsTableRows
              headers={tableHeaders}
              data={ranQuery?.data}
            />
          </tbody>
        </table>
        {
          state.ui.isLoading &&
            (<div className="results-table-loading"><Spinner /></div>)
        }
      </div>
    </div>
  )
}
