import { compact } from "lodash"
import { MODEL_STATE_TABLE_COLUMNS } from "../constants"

export const buildModelListOptions = (models: any[], email: string) => {
  const options: {[key: string]: any} = {}
  models.forEach((record: any) => {
    const modelName = record[MODEL_STATE_TABLE_COLUMNS.modelName]?.value
    const createEmail = record[MODEL_STATE_TABLE_COLUMNS.createdByEmail]?.value

    if (!options[createEmail]) {
      options[createEmail] = {
        label: createEmail,
        options: []
      }
    }
    options[createEmail].options.push({ value: modelName, label: modelName })
  })
  return Object.values(options).sort(sortMyModelsFirst(email))
}

const sortMyModelsFirst = (email: string) => {
  return (a: any, b: any) => {
    if (a.label === email) { return -1 }
    if (b.label === email) { return 1 }
    if (a.label < b.label) { return -1 }
    if (a.label > b.label) { return 1 }
    return 0
  }
}

export const filterModelListOptions = (models: any[], filterTerm: string) => {
  const filteredOptions = models.map((category) => {
    const filteredOptions = category.options.filter((option: any) => option.label.includes(filterTerm))
    if (filteredOptions.length <= 0) {
      return null
    }
    return {
      ...category,
      options: filteredOptions
    }
  })
  return compact(filteredOptions)
}