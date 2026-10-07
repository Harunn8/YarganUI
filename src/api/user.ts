import { data, userClient as c } from './http'
import type { AddUserModel, Guid, UpdateUserModel, UserResponse } from './types'

export const userApi = {
  getAll: () => data(c.get<UserResponse[] | null>('/User/GetAllUser')).then((users) => users ?? []),
  getById: (id: Guid) => data(c.get<UserResponse>(`/User/GetUserById/${id}`)),
  add: (model: AddUserModel) => data(c.post<UserResponse>('/User/AddUser', model)),
  update: (model: UpdateUserModel) => data(c.put<UserResponse>('/User/UpdateUser', model)),
  remove: (id: Guid) => data(c.delete(`/User/DeleteUser/${id}`)).then(() => true),
}
