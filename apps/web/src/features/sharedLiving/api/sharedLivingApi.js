import api from "../../../shared/api/client";
const root = "/shared-living";
const request = async (method, path, body) =>
  (await api.request({ method, url: `${root}${path}`, data: body })).data.data;
export default {
  spaces: () => request("get", "/spaces"),
  create: (body) => request("post", "/spaces", body),
  join: (body) => request("post", "/join", body),
  month: (space, month) => request("get", `/spaces/${space}/months/${month}`),
  save: (method, path, body) => request(method, path, body),
};
