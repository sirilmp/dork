import { api } from './client';
import { CustomFieldDefinition, CustomFieldType } from './types';

export interface CustomFieldDefinitionInput {
  name: string;
  fieldType: CustomFieldType;
  options?: string[];
  required?: boolean;
}

export const customFieldsApi = {
  list: (projectId: string) => api.get<CustomFieldDefinition[]>(`/projects/${projectId}/custom-fields`),
  create: (projectId: string, input: CustomFieldDefinitionInput) =>
    api.post<CustomFieldDefinition>(`/projects/${projectId}/custom-fields`, input),
  update: (
    projectId: string,
    id: string,
    input: Partial<Pick<CustomFieldDefinitionInput, 'name' | 'options' | 'required'>> & { order?: number }
  ) => api.patch<CustomFieldDefinition>(`/projects/${projectId}/custom-fields/${id}`, input),
  remove: (projectId: string, id: string) => api.delete<void>(`/projects/${projectId}/custom-fields/${id}`),
};
