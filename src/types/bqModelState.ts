import { SelectedFields } from ".";

export type BQModelState = {
  objective?: string,
  name: string,
  target?: string,
  arimaTimeColumn?: string,
  selectedFeatures?: string[],
  advancedSettings?: any,
  inputDataUID?: string,
  inputDataQuery: {
    exploreName?: string,
    modelName?: string,
    exploreLabel?: string,
    limit: string,
    sorts: string[],
    selectedFields: SelectedFields
  },
  jobStatus?: string,
  job?: any,
  look?: any,
  hasPredictions: boolean,
  applyQuery: {
    exploreName?: string,
    modelName?: string,
    exploreLabel?: string,
    limit?: string,
    sorts?: string[],
    selectedFields?: SelectedFields
  }
}
