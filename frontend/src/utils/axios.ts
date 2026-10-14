import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';

const axiosInt = axios.create();

axiosInt.interceptors.response.use(
  (response) => response,
  (error) => {
    const body = error.response?.data;
    const executionCode = typeof body?.code === 'string' ? body.code : '';
    if (
      typeof window !== 'undefined' &&
      (executionCode.startsWith('WORK_ORDER_EXECUTION_') ||
        executionCode === 'WORK_ORDER_ALREADY_IN_EXECUTION')
    ) {
      window.dispatchEvent(
        new CustomEvent('erione:work-order-execution-conflict', {
          detail: { workOrderId: body.workOrderId }
        })
      );
    }
    return Promise.reject(
      (error.response && error.response.data) || 'There is an error!'
    );
  }
);

export const mock = new AxiosMockAdapter(axiosInt, { delayResponse: 0 });

export default axiosInt;
