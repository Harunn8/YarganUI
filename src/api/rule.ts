import { data, listOr404, ruleClient as c } from './http'
import type {
  AddCronPolicyModel,
  AddScriptModel,
  CronPolicyResponse,
  Guid,
  PolicyScriptResponse,
  UpdateCronPolicyModel,
  UpdateScriptModel,
} from './types'

export const policyScriptApi = {
  getAll: () => listOr404(c.get<PolicyScriptResponse[]>('/PolicyScript/getall')),
  getById: (id: Guid) => data(c.get<PolicyScriptResponse>(`/PolicyScript/getbyid/${id}`)),
  add: (model: AddScriptModel) => data(c.post<PolicyScriptResponse>('/PolicyScript/add', model)),
  update: (model: UpdateScriptModel) => data(c.put<PolicyScriptResponse>('/PolicyScript/update', model)),
  /** Script'i bir kez çalıştırır (Rule Engine'e RunForOnce mesajı gider). */
  run: (id: Guid) => data(c.put<boolean>(`/PolicyScript/runpolicyscript/${id}`)),
  remove: (id: Guid) => data(c.delete<boolean>(`/PolicyScript/delete/${id}`)),
}

export const cronPolicyApi = {
  getAll: () => listOr404(c.get<CronPolicyResponse[]>('/CronPolicy/getall')),
  getActive: () => listOr404(c.get<CronPolicyResponse[]>('/CronPolicy/getactivejobs')),
  getById: (id: Guid) => data(c.get<CronPolicyResponse>(`/CronPolicy/getbyid/${id}`)),
  add: (model: AddCronPolicyModel) => data(c.post<CronPolicyResponse>('/CronPolicy/add', model)),
  update: (model: UpdateCronPolicyModel) => data(c.put<CronPolicyResponse>('/CronPolicy/update', model)),
  startOrStop: (id: Guid, isStart: boolean) => data(c.put<boolean>(`/CronPolicy/startorstop/${id},${isStart}`)),
  remove: (id: Guid) => data(c.delete<boolean>(`/CronPolicy/delete/${id}`)),
}
