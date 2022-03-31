import React, { createContext, useContext, useState } from 'react'
import { ExtensionContext2 } from '@looker/extension-sdk-react'
import { useStore } from './StoreProvider'
import { getLooksFolderName } from '../services/user'
import { createBoostedTreePredictSql, getBoostedTreePredictSql, MODEL_TYPES } from '../services/modelTypes'
import { bqResultsToLookerFormat, buildApplyFilters, getLookerColumnName, getPredictedColumnName } from '../services/apply'
import { BQML_LOOKER_MODEL } from '../constants'
import { WizardContext } from './WizardProvider'
import { BQMLContext } from './BQMLProvider'
import { BQModelState, WizardState } from '../types'

type IApplyContext = {
  isLoading?: boolean,
  initArima?: () => Promise<any>,
  getBoostedTreePredictions?: () => Promise<any>,
  generateBoostedTreePredictions?: (lookerSql: string) => Promise<any>
}

export const ApplyContext = createContext<IApplyContext>({})

/**
 * Apply provider
 */
export const ApplyProvider = ({ children }: any) => {
  const { state, dispatch } = useStore()
  const { coreSDK } = useContext(ExtensionContext2)
  const { persistModelState } = useContext(WizardContext)
  const { queryJob } = useContext(BQMLContext)
  const [ isLoading, setIsLoading ] = useState<boolean>(false)
  const { bqmlModelDatasetName } = state.userAttributes
  const { personalFolderId, looksFolderId, id: userId } = state.user
  const { bqModel } = state
  const { step5 } = state.wizard.steps

  const generateBoostedTreePredictions = async (lookerSql: string) => {
    try {
      const { ok } = await createBoostedTreePredictions?.(lookerSql)
      if (!ok) {
        return { ok: false }
      }
      const { ok: getOk, body: data } = await getBoostedTreePredictions?.()
      if (!getOk || !data.schema) {
        return { ok: false }
      }

      const tempBQModel: BQModelState = {
        ...bqModel,
        hasPredictions: true,
        applyQuery: {
          exploreName: step5.ranQuery?.exploreName,
          modelName: step5.ranQuery?.modelName,
          exploreLabel: step5.ranQuery?.exploreLabel,
          limit: step5.ranQuery?.limit,
          sorts: step5.ranQuery?.sorts,
          selectedFields: step5.ranQuery?.selectedFields
        }
      }
      const tempWizardState: WizardState = {
        ...state.wizard,
        steps: {
          ...state.wizard.steps,
          step5: {
            ...state.wizard.steps.step5,
            showPredictions: true
          },
        },
        unlockedStep: 5
      }

      const { ok: savedOk } = await persistModelState?.(tempWizardState, tempBQModel)
      if (!savedOk) {
        throw "Error occurred while saving model state"
      }

      dispatch ({ type: 'setBQModel', data: tempBQModel })
      dispatch ({ type: 'setUnlockedStep', step: 5 })
      return { ok: true }
    } catch (err) {
      dispatch({
        type: 'addError',
        error: 'Failed to generate predictions - ' + err
      })
      return { ok: false }
    }
  }

  const createBoostedTreePredictions = async (lookerSql: string) => {
    try {
      if (!bqmlModelDatasetName) { throw "No dataset provided" }
      const sql = createBoostedTreePredictSql({
        bqmlModelDatasetName,
        lookerSql,
        bqModelName: bqModel.name
      })
      const { ok, body } = await queryJob?.(sql)
      if (!ok) {
        throw "Unable to create table."
      }
      return { ok, body }
    } catch (err: any) {
      dispatch({
        type: 'addError',
        error: 'Failed to generate predictions - ' + err
      })
      return { ok: false }
    }
  }

  const getBoostedTreePredictions = async () => {
    try {
      if (!bqmlModelDatasetName || !bqModel.target || !bqModel.inputDataQuery.exploreName) {
        throw "This model does not have a dataset, target, or an explore, please try reloading."
      }
      const sql = getBoostedTreePredictSql({
        bqmlModelDatasetName,
        bqModelName: bqModel.name,
        sorts: step5.sorts || []
      })

      const { ok, body } = await queryJob?.(sql)
      if (!ok) {
        throw "Unable to find table."
      }

      if (!step5.exploreData) { throw 'Failed to format data as no explore data was provided.'}
      const formattedResults = bqResultsToLookerFormat(body, bqModel.inputDataQuery.exploreName, step5.exploreData)

      // Handles two different code paths.
      // 1. When there isn't a ran query, its loading an existing model for the first time.
      // 2. When there is a ranQuery, you are generating the predictions for an existing query.
      const ranQuery = step5.ranQuery ? {
          ...step5.ranQuery,
          data: formattedResults,
          rowCount: formattedResults.length,
          selectedFields: {
            ...step5.selectedFields,
            // add the predictedColumn so table headers will be regenerated
            predictions: [getPredictedColumnName(bqModel.target)]
          }
        } : {
          data: formattedResults,
          rowCount: formattedResults.length,
          sql: '',
          exploreUrl: '',
          exploreName: step5.exploreName,
          modelName: step5.modelName,
          exploreLabel: step5.exploreLabel,
          limit: step5.limit,
          selectedFields: {
            ...step5.selectedFields,
            // add the predictedColumn so table headers will be regenerated
            predictions: [getPredictedColumnName(bqModel.target)]
          },
          sorts: step5.sorts,
        }

      dispatch({
        type: 'addToStepData',
        step: 'step5',
        data: {
          ...step5,
          selectedFields: {
            ...step5.selectedFields,
            // add the predictedColumn so table headers will be regenerated
            predictions: [getPredictedColumnName(bqModel.target)]
          },
          ranQuery
        }
      })
      return { ok, body }
    } catch (err: any) {
      dispatch({
        type: 'addError',
        error: 'Failed to retrieve predictions - ' + err
      })
      return { ok: false }
    }
  }

  const initArima = async () => {
    setIsLoading(true)
    let folderId = looksFolderId
    if (!folderId) {
      folderId = await createLooksFolder()
    }
    if ((!bqModel.look || !bqModel.look.id) && folderId) {
      await createLook(folderId)
    }
    setIsLoading(false)
  }

  // Create a folder for our BQML Looks
  const createLooksFolder = async () => {
    if (!userId || !personalFolderId) {
      dispatch({
        type: 'addError',
        error: 'Failed to retrieve user or personal folder, please try refreshing.'
      })
      return
    }
    // Create a folder for bqml looks to be saved in
    const newFolderName = getLooksFolderName(userId)
    try {
      const { ok, value: looksFolder } = await coreSDK.create_folder({
        name: newFolderName,
        parent_id: `${personalFolderId}`,
      })
      dispatch({
        type: 'setUser',
        user: {
          looksFolderId: looksFolder.id
        }
      })
      return looksFolder.id
    } catch (err) {
      dispatch({
        type: 'addError',
        error: 'Failed to create the looks bqml folder - ' + err
      })
      console.log(err)
    }
  }

  const getLook = async () => {
    try {
      const { ok, value } = await coreSDK.look(`${bqModel.look.id}`)
    } catch (err) {
      dispatch({
        type: 'addError',
        error: 'Failed to load your predictions - ' + err
      })
    }
  }

  const createQuery = async () => {
    const {
      objective: bqModelObjective,
      name: bqModelName,
      target: bqModelTarget,
      arimaTimeColumn: bqModelArimaTimeColumn,
      advancedSettings: bqModelAdvancedSettings
    } = bqModel

    if (
      !bqModelObjective ||
      !bqModelName ||
      !bqModelTarget
    ) { return }

    try {
      const modelType = MODEL_TYPES[bqModelObjective]
      const filters = buildApplyFilters({
        modelType,
        bqModelObjective,
        bqModelName,
        bqModelTarget,
        bqModelArimaTimeColumn,
        bqModelAdvancedSettings
      })
      const { ok, value: queryResult } = await coreSDK.create_query({
        model: BQML_LOOKER_MODEL,
        view: modelType.exploreName,
        fields: ['arima_forecast.date_date', 'arima_forecast.total_forecast', 'arima_forecast.time_series_data_col'],
        filters
      })

      if (!ok) {
        throw "Query creation failed"
      }

      return queryResult
    } catch (error) {
      dispatch({
        type: 'addError',
        error: 'Failed - ' + error
      })
    }
  }

  const createLook = async (folderId: number) => {
    try {
      const { name: bqModelName } = bqModel
      const queryResult = await createQuery()
      const queryId = queryResult.id

      const look = await coreSDK.create_look({
        folder_id: folderId,
        query_id: queryId,
        title: bqModelName
      })
      if (!look.ok) {
        const error = look.error.errors[0]
        throw `${error.field} - ${error.message}`
      }

      const lookObj = {
        id: look.value.id,
        embedUrl: look.value.embed_url
      }
      await saveArimaState(lookObj)
    } catch (error) {
      dispatch({
        type: 'addError',
        error: 'Failed to create look - ' + error
      })
    }
  }

  const updateLook = async () => {
    try {
      const { name: bqModelName } = bqModel
      const queryResult = await createQuery()
      const queryId = queryResult.id

      const look = await coreSDK.update_look(bqModel.look.id, {
        query_id: queryId,
        title: bqModelName
      })
      if (!look.ok) {
        throw "error"
      }

      const lookObj = {
        id: look.value.id,
        embedUrl: look.value.embed_url
      }
      // save look id to BQ model state table
      await saveArimaState(lookObj)
    } catch (error) {
      dispatch({
        type: 'addError',
        error: 'Failed to update look - ' + error
      })
    }
  }

  const saveArimaState = async (lookObj: any) => {
    const { wizard, bqModel } = state
    const tempBQModel = { ...bqModel, look: lookObj }
    await persistModelState?.({ ...wizard }, tempBQModel)
    dispatch({
      type: 'setBQModel',
      data: { look: lookObj }
    })
  }

  return (
    <ApplyContext.Provider
      value={{
        isLoading,
        initArima,
        getBoostedTreePredictions,
        generateBoostedTreePredictions
      }}
    >
      {children}
    </ApplyContext.Provider>
  )
}
